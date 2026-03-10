#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Deploy concurrent-streaming app to Azure Container Apps.
.DESCRIPTION
  Builds and deploys Backend and Frontend container apps to ACA.
  - Backend: Python FastAPI running on port 8000
  - Frontend: Python Flask running on port 5000
.PARAMETER ResourceGroup
  Azure resource group name (default: concurrent-streaming-demo-rg)
.PARAMETER Location
  Azure region (default: japaneast)
.PARAMETER FrontendOnly
  Only deploy frontend, skip backend build/deploy
.PARAMETER SubscriptionId
  Azure subscription ID (optional, uses default if not specified)
#>
param(
  [string]$ResourceGroup = "concurrent-streaming-demo-rg",
  [string]$Location = "japaneast",
  [string]$SubscriptionId = "",
  [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"

# UTF-8 encoding for console output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Configuration
$BackendAppName = "concurrent-streaming-backend"
$FrontendAppName = "concurrent-streaming-frontend"
$AcaEnvName = "concurrent-streaming-demo-env"
$ImageTag = (Get-Date -Format "yyyyMMddHHmmss")
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Step {
  param([string]$Message)
  Write-Host "[*] $Message" -ForegroundColor Cyan
}

function Write-Success {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error-Exit {
  param([string]$Message)
  Write-Host "[ERROR] $Message" -ForegroundColor Red
  exit 1
}

function Suppress-AzWarnings {
  param([scriptblock]$Command)
  $WarningPreference = "SilentlyContinue"
  $ErrorActionPreference_Local = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $result = & $Command 2>&1 | Where-Object { $_ -notmatch "^WARNING:" }
    return $result
  }
  finally {
    $ErrorActionPreference = $ErrorActionPreference_Local
    $WarningPreference = "Continue"
  }
}

function Get-ResourceExists {
  param(
    [string]$ResourceGroup,
    [string]$ResourceType,
    [string]$ResourceName
  )
  try {
    $result = Suppress-AzWarnings {
      az $ResourceType show -g $ResourceGroup -n $ResourceName --query name -o tsv 2>$null
    }
    return $null -ne $result -and $result -ne ""
  }
  catch {
    return $false
  }
}

function Get-ContainerAppExists {
  param(
    [string]$ResourceGroup,
    [string]$AppName
  )
  try {
    $result = Suppress-AzWarnings {
      az containerapp list -g $ResourceGroup --query "[?name=='$AppName'].name | [0]" -o tsv 2>$null
    }
    return $null -ne $result -and $result -ne ""
  }
  catch {
    return $false
  }
}

# ============================================================================
# Initialize Azure CLI & Subscription
# ============================================================================

Write-Step "Initializing Azure CLI"
Suppress-AzWarnings { az config set extension.use_dynamic_install=yes_without_prompt 2>$null }
Suppress-AzWarnings { az extension add --name containerapp --upgrade 2>$null }

if (-not [string]::IsNullOrWhiteSpace($SubscriptionId)) {
  Write-Step "Setting subscription to $SubscriptionId"
  Suppress-AzWarnings { az account set --subscription $SubscriptionId 2>$null }
}

# ============================================================================
# Create Resource Group
# ============================================================================

Write-Step "Ensuring resource group '$ResourceGroup' in $Location"
Suppress-AzWarnings { az group create -n $ResourceGroup -l $Location 2>$null | Out-Null }

# ============================================================================
# Validate Backend Requirements (only on create)
# ============================================================================

$backendExists = Get-ContainerAppExists -ResourceGroup $ResourceGroup -AppName $BackendAppName

if (-not $FrontendOnly -and -not $backendExists) {
  Write-Step "Backend does not exist - will create. Validating required environment variables..."
  
  $missingEnvVars = @()
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_API_KEY"))) {
    $missingEnvVars += "AZURE_OPENAI_API_KEY"
  }
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT"))) {
    $missingEnvVars += "AZURE_OPENAI_ENDPOINT"
  }
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT"))) {
    $missingEnvVars += "AZURE_OPENAI_DEPLOYMENT"
  }

  if ($missingEnvVars.Count -gt 0) {
    Write-Error-Exit "Backend creation requires environment variables: $($missingEnvVars -join ', '). Please set them and try again."
  }
}

# ============================================================================
# Create or Reuse ACR
# ============================================================================

Write-Step "Ensuring Azure Container Registry"
$acr = Suppress-AzWarnings { az acr list -g $ResourceGroup --query "[0].name" -o tsv 2>$null }
if ([string]::IsNullOrWhiteSpace($acr)) {
  $suffix = Get-Random -Minimum 10000 -Maximum 99999
  $acr = "csdemo$suffix".ToLower()
  Write-Step "Creating new ACR: $acr"
  Suppress-AzWarnings { az acr create -g $ResourceGroup -n $acr --sku Basic --admin-enabled true 2>$null | Out-Null }
}
else {
  Write-Step "Using existing ACR: $acr"
}

$acrLoginServer = Suppress-AzWarnings { az acr show -g $ResourceGroup -n $acr --query loginServer -o tsv }
$acrUsername = Suppress-AzWarnings { az acr credential show -g $ResourceGroup -n $acr --query username -o tsv }
$acrPassword = Suppress-AzWarnings { az acr credential show -g $ResourceGroup -n $acr --query "passwords[0].value" -o tsv }

# ============================================================================
# Create or Reuse Log Analytics Workspace
# ============================================================================

Write-Step "Ensuring Log Analytics Workspace"
$lawName = "$ResourceGroup-law"
$lawExists = Get-ResourceExists -ResourceGroup $ResourceGroup -ResourceType "monitor log-analytics workspace" -ResourceName $lawName
if (-not $lawExists) {
  Suppress-AzWarnings { az monitor log-analytics workspace create -g $ResourceGroup -n $lawName -l $Location 2>$null | Out-Null }
}

$lawCustomerId = Suppress-AzWarnings { az monitor log-analytics workspace show -g $ResourceGroup -n $lawName --query customerId -o tsv }
$lawSharedKey = Suppress-AzWarnings { az monitor log-analytics workspace get-shared-keys -g $ResourceGroup -n $lawName --query primarySharedKey -o tsv }

# ============================================================================
# Build Container Images
# ============================================================================

Write-Step "Building container images (Backend: $BackendAppName, Frontend: $FrontendAppName, tag: $ImageTag)"
Push-Location $repoRoot
try {
  if (-not $FrontendOnly) {
    Write-Step "Building Backend image"
    Suppress-AzWarnings { az acr build --registry $acr --image "backend:$ImageTag" "Backend" 2>$null | Out-Null }
    Write-Host "  Backend image built: backend:$ImageTag" -ForegroundColor Gray
  }
  
  Write-Step "Building Frontend image"
  Suppress-AzWarnings { az acr build --registry $acr --image "frontend:$ImageTag" "Frontend" 2>$null | Out-Null }
  Write-Host "  Frontend image built: frontend:$ImageTag" -ForegroundColor Gray
}
finally {
  Pop-Location
}

$backendImage = "$acrLoginServer/backend:$ImageTag"
$frontendImage = "$acrLoginServer/frontend:$ImageTag"

Write-Host "  ACR Server: $acrLoginServer" -ForegroundColor Gray
Write-Host "  Backend full image: $backendImage" -ForegroundColor Gray
Write-Host "  Frontend full image: $frontendImage" -ForegroundColor Gray

# ============================================================================
# Create or Reuse ACA Environment
# ============================================================================

Write-Step "Ensuring Container Apps Environment: $AcaEnvName"
$acaEnvExists = Get-ResourceExists -ResourceGroup $ResourceGroup -ResourceType "containerapp env" -ResourceName $AcaEnvName
if (-not $acaEnvExists) {
  Suppress-AzWarnings {
    az containerapp env create `
      -g $ResourceGroup `
      -n $AcaEnvName `
      -l $Location `
      --logs-workspace-id $lawCustomerId `
      --logs-workspace-key $lawSharedKey 2>$null | Out-Null
  }
}

# ============================================================================
# Deploy Backend
# ============================================================================

if (-not $FrontendOnly) {
  if ($backendExists) {
    Write-Step "Updating existing Backend: $BackendAppName"
    Suppress-AzWarnings {
      az containerapp registry set `
        -g $ResourceGroup `
        -n $BackendAppName `
        --server $acrLoginServer `
        --username $acrUsername `
        --password $acrPassword 2>$null | Out-Null

      az containerapp update `
        -g $ResourceGroup `
        -n $BackendAppName `
        --image $backendImage `
        --set-env-vars PORT=8000 2>$null | Out-Null
    }
    Write-Host "  Updated to image: $backendImage" -ForegroundColor Gray
  }
  else {
    Write-Step "Creating new Backend: $BackendAppName"
    
    $aoaiKey = [Environment]::GetEnvironmentVariable("AZURE_OPENAI_API_KEY")
    $aoaiEndpoint = [Environment]::GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")
    $aoaiDeployment = [Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT")

    $secrets = @("aoai-key=$aoaiKey")
    $envVars = @(
      "AZURE_OPENAI_API_KEY=secretref:aoai-key",
      "AZURE_OPENAI_ENDPOINT=$aoaiEndpoint",
      "AZURE_OPENAI_DEPLOYMENT=$aoaiDeployment",
      "PORT=8000"
    )

    # Optional: Add Search settings if present
    $searchEndpoint = [Environment]::GetEnvironmentVariable("SEARCH_ENDPOINT")
    $searchApiKey = [Environment]::GetEnvironmentVariable("SEARCH_API_KEY")
    $searchIndexName = [Environment]::GetEnvironmentVariable("SEARCH_INDEX_NAME")
    $searchSemanticConfig = [Environment]::GetEnvironmentVariable("SEARCH_SEMANTIC_CONFIG")

    if (-not [string]::IsNullOrWhiteSpace($searchApiKey)) {
      $secrets += "search-api-key=$searchApiKey"
      $envVars += "SEARCH_API_KEY=secretref:search-api-key"
    }
    if (-not [string]::IsNullOrWhiteSpace($searchEndpoint)) { $envVars += "SEARCH_ENDPOINT=$searchEndpoint" }
    if (-not [string]::IsNullOrWhiteSpace($searchIndexName)) { $envVars += "SEARCH_INDEX_NAME=$searchIndexName" }
    if (-not [string]::IsNullOrWhiteSpace($searchSemanticConfig)) { $envVars += "SEARCH_SEMANTIC_CONFIG=$searchSemanticConfig" }

    Suppress-AzWarnings {
      az containerapp create `
        -g $ResourceGroup `
        -n $BackendAppName `
        --environment $AcaEnvName `
        --image $backendImage `
        --ingress internal `
        --target-port 8000 `
        --registry-server $acrLoginServer `
        --registry-username $acrUsername `
        --registry-password $acrPassword `
        --secrets $secrets `
        --env-vars $envVars 2>$null | Out-Null
    }
  }
}

# ============================================================================
# Deploy Frontend
# ============================================================================

$frontendExists = Get-ContainerAppExists -ResourceGroup $ResourceGroup -AppName $FrontendAppName

if ($frontendExists) {
  Write-Step "Updating existing Frontend: $FrontendAppName"
  Suppress-AzWarnings {
    az containerapp registry set `
      -g $ResourceGroup `
      -n $FrontendAppName `
      --server $acrLoginServer `
      --username $acrUsername `
      --password $acrPassword 2>$null | Out-Null

    az containerapp update `
      -g $ResourceGroup `
      -n $FrontendAppName `
      --image $frontendImage `
      --set-env-vars PORT=5000 2>$null | Out-Null
  }
  Write-Host "  Updated to image: $frontendImage" -ForegroundColor Gray
}
else {
  Write-Step "Creating new Frontend: $FrontendAppName"
  
  $envVars = @(
    "BACKEND_URL=http://$BackendAppName",
    "PORT=5000"
  )

  Suppress-AzWarnings {
    az containerapp create `
      -g $ResourceGroup `
      -n $FrontendAppName `
      --environment $AcaEnvName `
      --image $frontendImage `
      --ingress external `
      --target-port 5000 `
      --registry-server $acrLoginServer `
      --registry-username $acrUsername `
      --registry-password $acrPassword `
      --env-vars $envVars 2>$null | Out-Null
  }
}

# ============================================================================
# Output Results
# ============================================================================

$fqdn = Suppress-AzWarnings { az containerapp show -g $ResourceGroup -n $FrontendAppName --query properties.configuration.ingress.fqdn -o tsv }

Write-Success "Deployment completed!"
Write-Host ""
Write-Host "Frontend URL: https://$fqdn"
Write-Host "Backend (internal): http://$BackendAppName"
Write-Host ""
Write-Host "Verification:"
$currentBackendImage = Suppress-AzWarnings { az containerapp show -g $ResourceGroup -n $BackendAppName --query "properties.template.containers[0].image" -o tsv }
$currentFrontendImage = Suppress-AzWarnings { az containerapp show -g $ResourceGroup -n $FrontendAppName --query "properties.template.containers[0].image" -o tsv }
Write-Host "  Backend running: $currentBackendImage" -ForegroundColor Gray
Write-Host "  Frontend running: $currentFrontendImage" -ForegroundColor Gray
