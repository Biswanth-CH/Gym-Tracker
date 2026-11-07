import { useState } from 'react';
import { CloudOff, LogOut, RefreshCw, Upload, Wifi } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../auth/AuthProvider';
import { useCloudStatus } from '../hooks/useCloud';
import { cloudStore } from '../store/cloudStore';

/** Compact account + sync indicator shown on the profiles screen. */
export function AccountBar({ onImport }: { onImport?: () => void }) {
  const { user, signOut } = useAuth();
  const { connection, syncing } = useCloudStatus();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const label = syncing ? 'Syncing…' : connection === 'live' ? 'Synced' : connection === 'offline' ? 'Offline' : 'Connecting…';
  return (
    <div className="account-bar" data-testid="account-bar">
      <span className={`sync-pill sync-pill--${syncing ? 'syncing' : connection}`} title={`Cloud sync: ${label}`}>
        {connection === 'offline' ? <CloudOff size={14} aria-hidden="true" /> : syncing ? <RefreshCw size={14} className="spin" aria-hidden="true" /> : <Wifi size={14} aria-hidden="true" />}
        {label}
      </span>
      <span className="account-bar__email" title={user?.email}>
        {user?.email}
      </span>
      {onImport && (
        <button type="button" className="icon-button" onClick={onImport} aria-label="Import data saved in this browser" title="Import data saved in this browser">
          <Upload size={18} aria-hidden="true" />
        </button>
      )}
      <button type="button" className="icon-button" onClick={() => setLogoutOpen(true)} aria-label="Logout Account" title="Logout Account" data-testid="sign-out">
        <LogOut size={18} aria-hidden="true" />
      </button>
      <ConfirmDialog
        isOpen={logoutOpen}
        title="Log out of GymTrack?"
        description="You’ll be signed out of this account on this device. Your profiles and workouts stay saved in the cloud."
        confirmLabel="Logout Account"
        icon={<LogOut size={24} aria-hidden="true" />}
        destructive
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          signOut().catch(() => undefined);
        }}
      />
    </div>
  );
}

/** Global banner for connection problems and sync errors (all screens). */
export function SyncBanner() {
  const { connection, error, phase } = useCloudStatus();
  if (phase !== 'ready') return null;
  if (error) {
    return (
      <div className="sync-banner sync-banner--error" role="alert">
        <span>{error}</span>
        <button type="button" className="link-button" onClick={() => { cloudStore.clearError(); void cloudStore.refreshAll(); }}>
          Retry
        </button>
      </div>
    );
  }
  if (connection === 'offline' || connection === 'reconnecting') {
    return (
      <div className="sync-banner" role="status">
        <CloudOff size={14} aria-hidden="true" />
        <span>{connection === 'offline' ? 'You’re offline — changes can’t be saved until you reconnect.' : 'Reconnecting to live sync…'}</span>
      </div>
    );
  }
  return null;
}
