import React from 'react';
import { View, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { useGleanStore, type Member } from '../store/useGleanStore';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { showDialog } from '@/lib/overlay';
import { initialsFor } from '@/lib/initials';

const PAD = 24;

export default function MembersScreen() {
  const { house, profile, removeMember } = useGleanStore();
  const colors = useColors();

  const isOwner = !!house && house.owner_id === profile?.id;

  const confirmRemove = (member: Member) => {
    showDialog({
      title: 'Remove member',
      message: `Remove ${member.name} from ${house?.name ?? 'this household'}?`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => { void removeMember(member.id); },
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: PAD, paddingTop: PAD + 8, width: '100%', maxWidth: 720, alignSelf: 'center' }}
    >
      <Text style={{ fontSize: theme.type.caption, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
        {house?.name ?? 'Household'}
      </Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: theme.radii.md, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
        {(house?.members ?? []).map((member, i) => {
          const isYou = member.id === profile?.id;
          const isMemberOwner = member.id === house?.owner_id;
          const canRemove = isOwner && !isYou;
          return (
            <View key={member.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 68 }} />}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
                {member.avatar_url ? (
                  <Image source={{ uri: member.avatar_url }} style={{ width: 40, height: 40, borderRadius: theme.radii.xxl, backgroundColor: colors.surfaceSunken }} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: theme.radii.xxl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.onAccent, fontSize: theme.type.label, fontWeight: '700' }}>{initialsFor(member.name)}</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: theme.type.body, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {member.name}{isYou ? ' (you)' : ''}
                  </Text>
                  {isMemberOwner && (
                    <Text style={{ fontSize: theme.type.caption, color: colors.accent, fontWeight: '600', marginTop: 2 }}>Owner</Text>
                  )}
                </View>

                {canRemove && (
                  <Tappable
                    onPress={() => confirmRemove(member)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.name}`}
                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
                  </Tappable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Text style={{ fontSize: theme.type.caption, color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>
        {isOwner ? 'You can remove members. Invite more from Settings.' : 'Only the owner can remove members.'}
      </Text>
    </ScrollView>
  );
}
