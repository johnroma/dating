"use client";

import * as React from "react";

import type { Role } from "../src/lib/roles";

export function RoleSwitcher({
  currentRole,
  onSetRole,
}: {
  currentRole: Role;
  onSetRole: (role: Role) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        Current role: <span className="font-mono">{currentRole}</span>
      </div>
      <div className="flex gap-2">
        <button
          className="rounded border px-3 py-1 hover:bg-gray-100"
          onClick={async () => onSetRole("viewer")}
        >
          Viewer
        </button>
        <button
          className="rounded border px-3 py-1 hover:bg-gray-100"
          onClick={async () => onSetRole("creator")}
        >
          Creator
        </button>
        <button
          className="rounded border px-3 py-1 hover:bg-gray-100"
          onClick={async () => onSetRole("moderator")}
        >
          Moderator
        </button>
      </div>
    </div>
  );
}

export default RoleSwitcher;

