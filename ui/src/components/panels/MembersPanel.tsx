import { useState } from 'react';
import { api } from '../../api/client';
import type { Membership } from '../../api/types';
import { useList } from '../../hooks/useList';
import { useMessage } from '../../hooks/useMessage';
import MessageBanner from '../MessageBanner';

interface MembersPanelProps {
  storyId: number;
  canWrite: boolean;
}

export function MembersPanel({ storyId, canWrite }: MembersPanelProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EDITOR');
  const { msg, setMsg } = useMessage();

  const { items, reload } = useList<Membership>(() =>
    api.members(storyId).catch((e) => {
      setMsg(e.message);
      return [];
    }),
  );

  const add = async () => {
    try {
      await api.addMember(storyId, { email, role });
      setEmail('');
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const changeRole = async (userId: number, nextRole: string) => {
    try {
      await api.updateMemberRole(storyId, userId, nextRole);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const remove = async (userId: number, displayName: string) => {
    if (!window.confirm(`Remove ${displayName}?`)) return;
    try {
      await api.removeMember(storyId, userId);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="panel">
      <MessageBanner msg={msg} onClose={() => setMsg(null)} />
      <ul className="plain">
        {items.map((m) => (
          <li key={m.id} className="card tight member">
            <div>
              <strong>{m.displayName}</strong>
              <div className="muted small">{m.email}</div>
            </div>
            <select value={m.role} disabled={!canWrite} onChange={(e) => changeRole(m.userId, e.target.value)}>
              <option value="OWNER">owner</option>
              <option value="COLLABORATOR">collaborator</option>
              <option value="EDITOR">editor</option>
              <option value="VIEWER">viewer</option>
            </select>
            {canWrite && (
              <button className="small linkish" onClick={() => remove(m.userId, m.displayName)}>
                remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="add-form">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="COLLABORATOR">collaborator</option>
            <option value="EDITOR">editor</option>
            <option value="VIEWER">viewer</option>
          </select>
          <button className="small primary" disabled={!email.trim()} onClick={add}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}