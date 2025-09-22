'use client';

import * as React from 'react';

import type { Role } from '@/src/lib/roles';

export default function RoleSwitcher({
  currentRole,

  onSetRole,
}: {
  currentRole: Role;
  onSetRole: (role: Role) => Promise<void>;
}) {
  return (
    <div className='flex flex-col gap-3'>
      <div>
        Current role: <span className='font-mono'>{currentRole}</span>
      </div>
      <div className='flex gap-2'>
        <button
          className='rounded border px-3 py-1'
          onClick={() => onSetRole('viewer')}
        >
          Viewer
        </button>
        <button
          className='rounded border px-3 py-1'
          onClick={() => onSetRole('creator')}
        >
          Creator
        </button>
        <button
          className='rounded border px-3 py-1'
          onClick={() => onSetRole('moderator')}
        >
          Moderator
        </button>
      </div>
    </div>
  );
}
