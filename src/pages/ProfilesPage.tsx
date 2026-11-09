import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { ProfileCard } from '../components/ProfileCard';
import { ProfileModal } from '../components/ProfileModal';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { useProfileLocks } from '../hooks/useProfileLocks';
import { useProfileStreaks } from '../hooks/useProfileStreaks';
import type { Profile, ProfileInput } from '../types/gym';

interface ProfilesPageProps {
  profiles: Profile[];
  onOpenProfile: (profile: Profile) => void;
  onCreateProfile: (input: ProfileInput) => Promise<void>;
  onUpdateProfile: (profile: Profile, input: ProfileInput) => Promise<void>;
  onDeleteProfile: (profileId: string) => Promise<void>;
}

type EditorState = { isOpen: false } | { isOpen: true; profile: Profile | null };

export function ProfilesPage({
  profiles,
  onOpenProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
}: ProfilesPageProps) {
  const [editor, setEditor] = useState<EditorState>({ isOpen: false });
  const { toast, showToast } = useToast();
  const streaks = useProfileStreaks(profiles);
  const { isProfileLocked } = useProfileLocks();

  const editingProfile = editor.isOpen ? editor.profile : null;
  const openCreate = () => setEditor({ isOpen: true, profile: null });
  const closeEditor = () => setEditor({ isOpen: false });

  // Errors propagate to the modal, which shows them inline (nothing is closed on failure).
  const handleSave = async (input: ProfileInput) => {
    if (editor.isOpen && editor.profile) {
      await onUpdateProfile(editor.profile, input);
      showToast('Profile updated');
    } else {
      await onCreateProfile(input);
      showToast('Profile created');
    }
    closeEditor();
  };

  // Called from the Delete Profile danger section inside Edit Profile, after its confirmation.
  const handleDelete = async (profile: Profile) => {
    await onDeleteProfile(profile.id);
    closeEditor();
    showToast(`Deleted “${profile.name}”`, 'info');
  };

  return (
    <div className="page">

      <section className="section profiles-section" aria-labelledby="profiles-heading">
        <div className="section__header">
          <div>
            <h2 id="profiles-heading" className="section__title">
              Your Profiles
            </h2>
            <p className="section__meta">
              {profiles.length === 0
                ? 'No profiles yet'
                : `${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'}`}
            </p>
          </div>
          {profiles.length > 0 && (
            <button type="button" className="button button--subtle" onClick={openCreate} data-testid="add-profile">
              <Plus size={18} aria-hidden="true" />
              Add Profile
            </button>
          )}
        </div>

        {profiles.length === 0 ? (
          <EmptyState
            icon={<Users size={28} aria-hidden="true" />}
            title="Create your first profile"
            message="Each profile gets its own weekly workout plan. Add one for yourself or a training partner."
            action={
              <button type="button" className="button button--primary" onClick={openCreate}>
                <Plus size={18} aria-hidden="true" />
                Add Profile
              </button>
            }
          />
        ) : (
          <ul className="profile-grid" data-testid="profile-grid">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <ProfileCard
                  profile={profile}
                  streakDays={streaks.get(profile.id) ?? 0}
                  isLocked={isProfileLocked(profile.id)}
                  onOpen={onOpenProfile}
                  onEdit={(target) => setEditor({ isOpen: true, profile: target })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileModal
        isOpen={editor.isOpen}
        profile={editingProfile}
        onClose={closeEditor}
        onSave={handleSave}
        onDelete={editingProfile ? () => handleDelete(editingProfile) : undefined}
      />
      <Toast toast={toast} />
    </div>
  );
}
