#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Deploy concurrent-streaming app to Azure Container Apps.
.DESCRIPTION
  Builds and deploys Backend and Frontend container apps to ACA.
  - Backend: Python FastAPI running on port 8000
  - Frontend: Python Flask running on port 5001
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

function Get-ModelEnvSuffix {
  param([string]$ModelId)
  $normalized = [regex]::Replace($ModelId, "[^A-Za-z0-9]+", "_").Trim("_").ToUpperInvariant()
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return "DEFAULT"
  }
  return $normalized
}

function Get-SecretName {
  param([string]$EnvName)
  return ($EnvName.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-")
}

function Add-PlainEnvVar {
  param(
    [System.Collections.Generic.List[string]]$EnvVars,
    [string]$Name
  )
  $value = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    $EnvVars.Add("${Name}=$value")
  }
}

function Add-SecretEnvVar {
  param(
    [System.Collections.Generic.List[string]]$EnvVars,
    [System.Collections.Generic.List[string]]$Secrets,
    [string]$Name
  )
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    return
  }

  $secretName = Get-SecretName -EnvName $Name
  $Secrets.Add("${secretName}=$value")
  $EnvVars.Add("${Name}=secretref:${secretName}")
}

function Get-BackendDeploymentConfig {
  param([switch]$RequireModelConfig)

  $secrets = [System.Collections.Generic.List[string]]::new()
  $envVars = [System.Collections.Generic.List[string]]::new()
  $missingEnvVars = [System.Collections.Generic.List[string]]::new()
  $hasModelConfig = $false

  $llmModelsRaw = [Environment]::GetEnvironmentVariable("LLM_MODELS")
  if (-not [string]::IsNullOrWhiteSpace($llmModelsRaw)) {
    $hasModelConfig = $true
    $envVars.Add("LLM_MODELS=$llmModelsRaw")
    Add-PlainEnvVar -EnvVars $envVars -Name "DEFAULT_MODEL"

    $modelIds = $llmModelsRaw -split "," | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    foreach ($modelId in $modelIds) {
      $suffix = Get-ModelEnvSuffix -ModelId $modelId
      $prefix = "LLM_MODEL_${suffix}_"

      $providerName = "${prefix}PROVIDER"
      $provider = [Environment]::GetEnvironmentVariable($providerName)
      if ([string]::IsNullOrWhiteSpace($provider)) {
        $missingEnvVars.Add($providerName)
        continue
      }

      $provider = $provider.Trim().ToLowerInvariant()
      $envVars.Add("${providerName}=$provider")
      Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}LABEL"
      Add-SecretEnvVar -EnvVars $envVars -Secrets $secrets -Name "${prefix}API_KEY"

      switch ($provider) {
        "azure" {
          Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}ENDPOINT"
          Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}API_VERSION"
          Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}DEPLOYMENT"

          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("${prefix}API_KEY"))) {
            $missingEnvVars.Add("${prefix}API_KEY")
          }
          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("${prefix}ENDPOINT"))) {
            $missingEnvVars.Add("${prefix}ENDPOINT")
          }
          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("${prefix}DEPLOYMENT"))) {
            $missingEnvVars.Add("${prefix}DEPLOYMENT")
          }
        }
        "openai" {
          Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}MODEL_ID"
          Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}ENDPOINT"
          Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}BASE_URL"
          Add-PlainEnvVar -EnvVars $envVars -Name "${prefix}ORG_ID"

          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("${prefix}API_KEY"))) {
            $missingEnvVars.Add("${prefix}API_KEY")
          }
          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("${prefix}MODEL_ID"))) {
            $missingEnvVars.Add("${prefix}MODEL_ID")
          }
        }
        default {
          $missingEnvVars.Add("${prefix}PROVIDER(azure|openai)")
        }
      }
    }
  }
  else {
    $legacySignals = @(
      [Environment]::GetEnvironmentVariable("AZURE_OPENAI_API_KEY"),
      [Environment]::GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT"),
      [Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT"),
      [Environment]::GetEnvironmentVariable("AZURE_OPENAI_MODELS")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    if ($legacySignals.Count -gt 0) {
      $hasModelConfig = $true
      Add-PlainEnvVar -EnvVars $envVars -Name "DEFAULT_MODEL"

      $legacyNamedModelsRaw = [Environment]::GetEnvironmentVariable("AZURE_OPENAI_MODELS")
      if (-not [string]::IsNullOrWhiteSpace($legacyNamedModelsRaw)) {
        $envVars.Add("AZURE_OPENAI_MODELS=$legacyNamedModelsRaw")
        $legacyModelIds = $legacyNamedModelsRaw -split "," |
          ForEach-Object { $_.Trim() } |
          Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        foreach ($modelId in $legacyModelIds) {
          $suffix = Get-ModelEnvSuffix -ModelId $modelId
          Add-PlainEnvVar -EnvVars $envVars -Name "AZURE_OPENAI_MODEL_${suffix}_LABEL"
          Add-PlainEnvVar -EnvVars $envVars -Name "AZURE_OPENAI_MODEL_${suffix}_ENDPOINT"
          Add-PlainEnvVar -EnvVars $envVars -Name "AZURE_OPENAI_MODEL_${suffix}_API_VERSION"
          Add-PlainEnvVar -EnvVars $envVars -Name "AZURE_OPENAI_MODEL_${suffix}_DEPLOYMENT"
          Add-SecretEnvVar -EnvVars $envVars -Secrets $secrets -Name "AZURE_OPENAI_MODEL_${suffix}_API_KEY"

          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_MODEL_${suffix}_API_KEY"))) {
            $missingEnvVars.Add("AZURE_OPENAI_MODEL_${suffix}_API_KEY")
          }
          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_MODEL_${suffix}_ENDPOINT"))) {
            $missingEnvVars.Add("AZURE_OPENAI_MODEL_${suffix}_ENDPOINT")
          }
          if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_MODEL_${suffix}_DEPLOYMENT"))) {
            $missingEnvVars.Add("AZURE_OPENAI_MODEL_${suffix}_DEPLOYMENT")
          }
        }
      }
      else {
        Add-SecretEnvVar -EnvVars $envVars -Secrets $secrets -Name "AZURE_OPENAI_API_KEY"
        Add-PlainEnvVar -EnvVars $envVars -Name "AZURE_OPENAI_ENDPOINT"
        Add-PlainEnvVar -EnvVars $envVars -Name "AZURE_OPENAI_API_VERSION"
        Add-PlainEnvVar -EnvVars $envVars -Name "AZURE_OPENAI_DEPLOYMENT"

        $legacyOptionalNames = @(
          "AZURE_OPENAI_DEPLOYMENT_GPT41",
          "AZURE_OPENAI_DEPLOYMENT_GPT41_MINI",
          "AZURE_OPENAI_DEPLOYMENT_GPT41_NANO",
          "AZURE_OPENAI_DEPLOYMENT_GPT52",
          "AZURE_OPENAI_DEPLOYMENT_GPT52_CHAT"
        )
        foreach ($name in $legacyOptionalNames) {
          Add-PlainEnvVar -EnvVars $envVars -Name $name
        }

        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_API_KEY"))) {
          $missingEnvVars.Add("AZURE_OPENAI_API_KEY")
        }
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT"))) {
          $missingEnvVars.Add("AZURE_OPENAI_ENDPOINT")
        }
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT")) -and
            [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_GPT41")) -and
            [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_GPT41_MINI")) -and
            [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_GPT41_NANO")) -and
            [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_GPT52")) -and
            [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_GPT52_CHAT"))) {
          $missingEnvVars.Add("AZURE_OPENAI_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT_*")
        }
      }
    }
    elseif ($RequireModelConfig) {
      $missingEnvVars.Add("LLM_MODELS (or legacy AZURE_OPENAI_* settings)")
    }
  }

  Add-PlainEnvVar -EnvVars $envVars -Name "SEARCH_ENDPOINT"
  Add-SecretEnvVar -EnvVars $envVars -Secrets $secrets -Name "SEARCH_API_KEY"
  Add-PlainEnvVar -EnvVars $envVars -Name "SEARCH_INDEX_NAME"
  Add-PlainEnvVar -EnvVars $envVars -Name "SEARCH_SEMANTIC_CONFIG"
  Add-PlainEnvVar -EnvVars $envVars -Name "LANGUAGE"
  Add-PlainEnvVar -EnvVars $envVars -Name "SESSION_HISTORY_MESSAGES"
  Add-PlainEnvVar -EnvVars $envVars -Name "PROMPT_HISTORY_MESSAGES"

  return [PSCustomObject]@{
    HasModelConfig = $hasModelConfig
    Secrets = $secrets.ToArray()
    EnvVars = $envVars.ToArray()
    MissingEnvVars = $missingEnvVars.ToArray()
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
  $backendConfig = Get-BackendDeploymentConfig -RequireModelConfig

  if ($backendConfig.MissingEnvVars.Count -gt 0) {
    Write-Error-Exit "Backend creation requires environment variables: $($backendConfig.MissingEnvVars -join ', '). Please set them and try again."
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
  if (-not $backendExists) {
    $backendConfig = Get-BackendDeploymentConfig -RequireModelConfig
  }
  else {
    $backendConfig = Get-BackendDeploymentConfig
    if ($backendConfig.HasModelConfig -and $backendConfig.MissingEnvVars.Count -gt 0) {
      Write-Error-Exit "Backend update requires complete model environment variables when LLM settings are provided: $($backendConfig.MissingEnvVars -join ', ')."
    }
  }

  if ($backendExists) {
    Write-Step "Updating existing Backend: $BackendAppName"
    Suppress-AzWarnings {
      az containerapp registry set `
        -g $ResourceGroup `
        -n $BackendAppName `
        --server $acrLoginServer `
        --username $acrUsername `
        --password $acrPassword 2>$null | Out-Null

      if ($backendConfig.Secrets.Count -gt 0) {
        az containerapp secret set `
          -g $ResourceGroup `
          -n $BackendAppName `
          --secrets $backendConfig.Secrets 2>$null | Out-Null
      }

      if ($backendConfig.EnvVars.Count -gt 0) {
        az containerapp update `
          -g $ResourceGroup `
          -n $BackendAppName `
          --image $backendImage `
          --set-env-vars $backendConfig.EnvVars 2>$null | Out-Null
      }
      else {
        az containerapp update `
          -g $ResourceGroup `
          -n $BackendAppName `
          --image $backendImage 2>$null | Out-Null
      }
    }
    Write-Host "  Updated to image: $backendImage" -ForegroundColor Gray
  }
  else {
    Write-Step "Creating new Backend: $BackendAppName"

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
        --secrets $backendConfig.Secrets `
        --env-vars $backendConfig.EnvVars 2>$null | Out-Null
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
      --target-port 5001 2>$null | Out-Null
  }
  Write-Host "  Updated to image: $frontendImage" -ForegroundColor Gray
}
else {
  Write-Step "Creating new Frontend: $FrontendAppName"
  
  $envVars = @(
    "BACKEND_URL=http://$BackendAppName"
  )

  Suppress-AzWarnings {
    az containerapp create `
      -g $ResourceGroup `
      -n $FrontendAppName `
      --environment $AcaEnvName `
      --image $frontendImage `
      --ingress external `
      --target-port 5001 `
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
