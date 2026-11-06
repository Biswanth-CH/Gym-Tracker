import { useCallback, useEffect, useState } from 'react';
import {
  createProfile,
  deleteProfile,
  getProfiles,
  subscribeToProfileChanges,
  updateProfile,
} from '../services/profileStorageService';
import type { Profile, ProfileUpdates } from '../types/gym';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface UseProfilesResult {
  profiles: Profile[];
  status: LoadStatus;
  loadError: string | null;
  reload: () => void;
  addProfile: (name: string) => Profile;
  editProfile: (profileId: string, updates: ProfileUpdates) => Profile;
  removeProfile: (profileId: string) => void;
}

/**
 * Bridges the storage service and React state. Mutations throw on failure
 * (the caller shows the message) and refresh state immediately on success.
 */
export function useProfiles(): UseProfilesResult {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setProfiles(getProfiles());
      setLoadError(null);
      setStatus('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load profiles.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    reload();
    return subscribeToProfileChanges(reload);
  }, [reload]);

  const addProfile = useCallback((name: string) => {
    const profile = createProfile(name);
    setProfiles(getProfiles());
    return profile;
  }, []);

  const editProfile = useCallback((profileId: string, updates: ProfileUpdates) => {
    const profile = updateProfile(profileId, updates);
    setProfiles(getProfiles());
    return profile;
  }, []);

  const removeProfile = useCallback((profileId: string) => {
    deleteProfile(profileId);
    setProfiles(getProfiles());
  }, []);

  return { profiles, status, loadError, reload, addProfile, editProfile, removeProfile };
}
