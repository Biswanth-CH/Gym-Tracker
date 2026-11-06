import { useState } from 'react';
import { Dumbbell, Plus, Users } from 'lucide-react';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { EmptyState } from '../components/EmptyState';
import { ProfileCard } from '../components/ProfileCard';
import { ProfileModal } from '../components/ProfileModal';
import type { Profile } from '../types/gym';

interface ProfilesPageProps {
  profiles: Profile[];
  onOpenProfile: (profile: Profile) => void;
  onCreateProfile: (name: string) => void;
  onUpdateProfile: (profileId: string, name: string) => void;
  onDeleteProfile: (profileId: string) => void;
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
  const [profilePendingDelete, setProfilePendingDelete] = useState<Profile | null>(null);

  const openCreate = () => setEditor({ isOpen: true, profile: null });
  const closeEditor = () => setEditor({ isOpen: false });

  const handleSave = (name: string) => {
    if (editor.isOpen && editor.profile) {
      onUpdateProfile(editor.profile.id, name);
    } else {
      onCreateProfile(name);
    }
    closeEditor();
  };

  const handleConfirmDelete = (profile: Profile) => {
    onDeleteProfile(profile.id);
    setProfilePendingDelete(null);
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <Dumbbell size={22} strokeWidth={2.4} />
          </span>
          <h1 className="brand__name">
            Gym<span>Track</span>
          </h1>
        </div>
        <p className="hero__subtitle">Build consistency. Track progress.</p>
      </header>

      <section className="section" aria-labelledby="profiles-heading">
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
            <button type="button" className="button button--primary button--compact" onClick={openCreate}>
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
          <ul className="profile-list">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <ProfileCard
                  profile={profile}
                  onOpen={onOpenProfile}
                  onEdit={(target) => setEditor({ isOpen: true, profile: target })}
                  onDelete={setProfilePendingDelete}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileModal
        isOpen={editor.isOpen}
        profile={editor.isOpen ? editor.profile : null}
        onClose={closeEditor}
        onSave={handleSave}
      />
      <DeleteConfirmationModal
        profile={profilePendingDelete}
        onCancel={() => setProfilePendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
