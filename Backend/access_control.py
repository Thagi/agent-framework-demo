import json
import os
from dataclasses import dataclass
from typing import Any

VISIBILITY_SHARED = "shared"
VISIBILITY_PRIVATE = "private"
ALLOWED_VISIBILITIES = {VISIBILITY_SHARED, VISIBILITY_PRIVATE}


@dataclass(frozen=True)
class DemoUser:
    user_id: str
    name: str
    role: str = ""


@dataclass(frozen=True)
class DemoWorkspace:
    workspace_id: str
    name: str
    visibility: str
    member_ids: tuple[str, ...]
    description: str = ""


@dataclass(frozen=True)
class AccessContext:
    user_id: str
    user_name: str
    user_role: str
    workspace_id: str
    workspace_name: str
    workspace_visibility: str
    effective_session_id: str

    @property
    def is_shared(self) -> bool:
        return self.workspace_visibility == VISIBILITY_SHARED


def _normalize_id(value: str | None, fallback: str) -> str:
    text = str(value or "").strip()
    return text or fallback


class AccessRegistry:
    def __init__(self) -> None:
        self.users = self._load_users()
        self.workspaces = self._load_workspaces()
        self.default_user_id = self._resolve_default_user_id()

    def _load_json_env(self, name: str) -> Any:
        raw = os.getenv(name, "").strip()
        if not raw:
            return None
        return json.loads(raw)

    def _load_users(self) -> dict[str, DemoUser]:
        raw_users = self._load_json_env("DEMO_USERS_JSON")
        if not isinstance(raw_users, list):
            raw_users = [
                {"id": "alice", "name": "Alice", "role": "Strategy Lead"},
                {"id": "bob", "name": "Bob", "role": "Risk Officer"},
            ]

        users: dict[str, DemoUser] = {}
        for item in raw_users:
            if not isinstance(item, dict):
                continue
            user_id = _normalize_id(item.get("id"), "")
            name = _normalize_id(item.get("name"), user_id)
            if not user_id:
                continue
            users[user_id] = DemoUser(
                user_id=user_id,
                name=name,
                role=str(item.get("role", "") or "").strip(),
            )
        if not users:
            users["demo"] = DemoUser(user_id="demo", name="Demo User")
        return users

    def _load_workspaces(self) -> dict[str, DemoWorkspace]:
        raw_workspaces = self._load_json_env("DEMO_WORKSPACES_JSON")
        if not isinstance(raw_workspaces, list):
            raw_workspaces = [
                {
                    "id": "board-room",
                    "name": "Board Room",
                    "visibility": VISIBILITY_SHARED,
                    "members": ["alice", "bob"],
                    "description": "Shared executive workspace",
                },
                {
                    "id": "alice-private",
                    "name": "Alice Private Deck",
                    "visibility": VISIBILITY_PRIVATE,
                    "members": ["alice"],
                    "description": "Private workspace for Alice",
                },
                {
                    "id": "bob-private",
                    "name": "Bob Private Deck",
                    "visibility": VISIBILITY_PRIVATE,
                    "members": ["bob"],
                    "description": "Private workspace for Bob",
                },
            ]

        workspaces: dict[str, DemoWorkspace] = {}
        for item in raw_workspaces:
            if not isinstance(item, dict):
                continue
            workspace_id = _normalize_id(item.get("id"), "")
            name = _normalize_id(item.get("name"), workspace_id)
            visibility = str(item.get("visibility", VISIBILITY_SHARED) or VISIBILITY_SHARED).strip().lower()
            if visibility not in ALLOWED_VISIBILITIES:
                visibility = VISIBILITY_SHARED
            members = item.get("members")
            if not isinstance(members, list):
                members = []
            member_ids = tuple(
                user_id
                for raw_member in members
                if (user_id := _normalize_id(raw_member, "")) and user_id in self.users
            )
            if not workspace_id or not member_ids:
                continue
            workspaces[workspace_id] = DemoWorkspace(
                workspace_id=workspace_id,
                name=name,
                visibility=visibility,
                member_ids=member_ids,
                description=str(item.get("description", "") or "").strip(),
            )

        if not workspaces:
            first_user_id = next(iter(self.users))
            workspaces["default-space"] = DemoWorkspace(
                workspace_id="default-space",
                name="Default Workspace",
                visibility=VISIBILITY_PRIVATE,
                member_ids=(first_user_id,),
            )
        return workspaces

    def _resolve_default_user_id(self) -> str:
        configured = os.getenv("DEFAULT_DEMO_USER", "").strip()
        if configured in self.users:
            return configured
        return next(iter(self.users))

    def workspaces_for_user(self, user_id: str) -> list[DemoWorkspace]:
        return [workspace for workspace in self.workspaces.values() if user_id in workspace.member_ids]

    def default_workspace_for_user(self, user_id: str) -> DemoWorkspace:
        configured = os.getenv("DEFAULT_DEMO_WORKSPACE", "").strip()
        if configured in self.workspaces and user_id in self.workspaces[configured].member_ids:
            return self.workspaces[configured]
        user_workspaces = self.workspaces_for_user(user_id)
        if user_workspaces:
            return user_workspaces[0]
        fallback = next(iter(self.workspaces.values()))
        return fallback

    def build_effective_session_id(self, *, workspace: DemoWorkspace, user_id: str, client_session_id: str) -> str:
        base = f"ws:{workspace.workspace_id}::session:{client_session_id}"
        if workspace.visibility == VISIBILITY_SHARED:
            return base
        return f"ws:{workspace.workspace_id}::user:{user_id}::session:{client_session_id}"

    def resolve(
        self,
        *,
        user_id: str | None,
        workspace_id: str | None,
        client_session_id: str,
    ) -> AccessContext:
        resolved_user_id = _normalize_id(user_id, self.default_user_id)
        if resolved_user_id not in self.users:
            raise ValueError(f"Unknown user: {resolved_user_id}")
        user = self.users[resolved_user_id]

        if workspace_id and workspace_id in self.workspaces and resolved_user_id in self.workspaces[workspace_id].member_ids:
            workspace = self.workspaces[workspace_id]
        else:
            workspace = self.default_workspace_for_user(resolved_user_id)

        if resolved_user_id not in workspace.member_ids:
            raise ValueError(f"User '{resolved_user_id}' cannot access workspace '{workspace.workspace_id}'")

        return AccessContext(
            user_id=user.user_id,
            user_name=user.name,
            user_role=user.role,
            workspace_id=workspace.workspace_id,
            workspace_name=workspace.name,
            workspace_visibility=workspace.visibility,
            effective_session_id=self.build_effective_session_id(
                workspace=workspace,
                user_id=user.user_id,
                client_session_id=client_session_id,
            ),
        )

    def bootstrap_payload(self) -> dict[str, Any]:
        users = []
        workspaces = []
        for user in self.users.values():
            user_workspaces = self.workspaces_for_user(user.user_id)
            users.append(
                {
                    "id": user.user_id,
                    "name": user.name,
                    "role": user.role,
                    "default_workspace_id": self.default_workspace_for_user(user.user_id).workspace_id if user_workspaces else None,
                }
            )

        for workspace in self.workspaces.values():
            workspaces.append(
                {
                    "id": workspace.workspace_id,
                    "name": workspace.name,
                    "visibility": workspace.visibility,
                    "member_ids": list(workspace.member_ids),
                    "description": workspace.description,
                }
            )

        return {
            "default_user_id": self.default_user_id,
            "users": users,
            "workspaces": workspaces,
        }
