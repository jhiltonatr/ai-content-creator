import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { AdminUser, SystemRole } from '../api/types';

interface EditState {
  id: number;
  email: string;
  displayName: string;
  systemRole: SystemRole;
  enabled: boolean;
}

const ROLE_OPTIONS: SystemRole[] = ['USER', 'ADMIN'];

export default function AdminUsers({ meId }: { meId: number | null }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showingCreate, setShowingCreate] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editPassword, setEditPassword] = useState('');

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [systemRole, setSystemRole] = useState<SystemRole>('USER');

  const load = useCallback(() => {
    setError(null);
    return api
      .adminUsers()
      .then(setUsers)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setUsers([]);
    setShowingCreate(false);
    setEdit(null);
    load();
  };

  const openEdit = (u: AdminUser) => {
    setEdit({ id: u.id, email: u.email, displayName: u.displayName, systemRole: u.systemRole, enabled: u.enabled });
    setEditPassword('');
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.adminCreateUser({ email: email.trim(), displayName: displayName.trim(), password, systemRole });
      setEmail('');
      setDisplayName('');
      setPassword('');
      setSystemRole('USER');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setError(null);
    try {
      await api.adminUpdateUser(edit.id, {
        email: edit.email.trim(),
        displayName: edit.displayName.trim(),
        systemRole: edit.systemRole,
        enabled: edit.enabled,
      });
      if (editPassword) {
        await api.adminResetPassword(edit.id, editPassword);
      }
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete user "${u.email}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await api.adminDeleteUser(u.id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isSelf = (id: number) => id === meId;

  return (
    <div className="page">
      <div className="page-head">
        <h1>User administration</h1>
        <button className="small" onClick={() => setShowingCreate((v) => !v)}>
          {showingCreate ? 'Cancel' : 'Create user'}
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}

      {showingCreate && (
        <form className="card" onSubmit={submitCreate}>
          <h3>Create user</h3>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Display name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={systemRole} onChange={(e) => setSystemRole(e.target.value as SystemRole)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" type="submit">
            Create
          </button>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.displayName || '—'}
                {isSelf(u.id) && <span className="tag">you</span>}
              </td>
              <td>{u.email}</td>
              <td>{u.systemRole.toLowerCase()}</td>
              <td>
                <span className={`status-dot ${u.enabled ? 'ok' : 'off'}`} />
                {u.enabled ? 'enabled' : 'disabled'}
              </td>
              <td className="row-actions">
                <button className="small" onClick={() => openEdit(u)}>
                  Edit
                </button>
                {!isSelf(u.id) && (
                  <button className="small danger" onClick={() => deleteUser(u)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!users.length && !error && <p className="muted">Loading users…</p>}

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <form className="card modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submitEdit}>
            <h3>Edit user</h3>
            <div className="field">
              <label>Email</label>
              <input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Display name</label>
              <input type="text" value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} />
            </div>
            <div className="field">
              <label>Role</label>
              <select
                value={edit.systemRole}
                disabled={isSelf(edit.id)}
                onChange={(e) => setEdit({ ...edit, systemRole: e.target.value as SystemRole })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={edit.enabled}
                disabled={isSelf(edit.id)}
                onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })}
              />
              Account enabled
            </label>
            <div className="field">
              <label>New password (optional)</label>
              <input
                type="password"
                value={editPassword}
                minLength={8}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            {isSelf(edit.id) && <p className="muted small">You cannot change your own role or disable your own account.</p>}
            <div className="modal-actions">
              <button type="button" className="small" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}