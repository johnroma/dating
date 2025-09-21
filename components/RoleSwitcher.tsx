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
          onClick={() => void onSetRole('guest')}
        >
          Guest
        </button>
        <button
          className='rounded border px-3 py-1'
          onClick={() => void onSetRole('member')}
        >
          Member
        </button>
        <button
          className='rounded border px-3 py-1'
          onClick={() => void onSetRole('admin')}
        >
          Admin
        </button>
      </div>
    </div>
  );
}
