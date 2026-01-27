/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { classNameFactory } from "@api/Styles";
import { Devs } from "@utils/constants";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Guild, Role } from "@vencord/discord-types";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { GuildMemberStore, GuildRoleStore, Menu, ScrollerThin, Text, useMemo, UserStore, useState } from "@webpack/common";

const { openUserProfileModal } = findByPropsLazy("openUserProfileModal");
const GuildSettingsActions = findByPropsLazy("open", "selectRole", "updateGuild");

type GetRoleIconData = (role: Role, size: number) => { customIconSrc?: string; unicodeEmoji?: { url: string; }; };
const getRoleIconData: GetRoleIconData = findByCodeLazy("convertSurrogateToName", "customIconSrc", "unicodeEmoji");

const cl = classNameFactory("vc-rolemem-");

interface User {
    id: string;
    username: string;
    globalName?: string;
    getAvatarURL: (guildId?: string, size?: number) => string;
}

interface Member {
    userId: string;
    nick?: string;
}

function getRoleIconSrc(role: Role) {
    const icon = getRoleIconData(role, 20);
    if (!icon) return;

    const { customIconSrc, unicodeEmoji } = icon;
    return customIconSrc ?? unicodeEmoji?.url;
}

function RoleMembersModal({ guild, modalProps }: { guild: Guild; modalProps: ModalProps; }) {
    const roles = GuildRoleStore.getSortedRoles(guild.id).filter(role => role.id !== guild.id);

    const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");

    const selectedRole = roles[selectedRoleIndex];

    // Re-render when member cache updates
    const allMemberIds = GuildMemberStore.getMemberIds(guild.id);

    const memberIds = useMemo(() => {
        if (!selectedRole) return [];
        return fetchRoleMembers(guild.id, selectedRole.id);
    }, [selectedRole?.id, guild.id, allMemberIds.length]);

    const members = useMemo(() => {
        return memberIds
            .map(id => {
                const user = UserStore.getUser(id) as User | undefined;
                const member = GuildMemberStore.getMember(guild.id, id) as Member | undefined;
                return user ? { user, member } : null;
            })
            .filter((m): m is { user: User; member: Member | undefined; } => m !== null);
    }, [memberIds, guild.id]);

    const filteredMembers = useMemo(() => {
        if (!searchQuery) return members;
        const query = searchQuery.toLowerCase();
        return members.filter(m =>
            m.user.username.toLowerCase().includes(query) ||
            m.user.globalName?.toLowerCase().includes(query) ||
            m.member?.nick?.toLowerCase().includes(query)
        );
    }, [members, searchQuery]);

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text className={cl("modal-title")} variant="heading-lg/semibold">{guild.name} Role Members</Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent className={cl("modal-content")}>
                {roles.length === 0 ? (
                    <div className={cl("modal-no-roles")}>
                        <Text variant="heading-lg/normal">No roles to display!</Text>
                    </div>
                ) : (
                    <div className={cl("modal-container")}>
                        <ScrollerThin className={cl("modal-list")} orientation="auto">
                            {roles.map((role, index) => {
                                const roleIconSrc = getRoleIconSrc(role);
                                return (
                                    <div
                                        key={role.id}
                                        className={cl("modal-list-item-btn")}
                                        onClick={() => {
                                            setSelectedRoleIndex(index);
                                            setSearchQuery("");
                                        }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div className={cl("modal-list-item", { "modal-list-item-active": selectedRoleIndex === index })}>
                                            <span
                                                className={cl("modal-role-circle")}
                                                style={{ backgroundColor: role.colorString ?? "var(--primary-300)" }}
                                            />
                                            {roleIconSrc && (
                                                <img
                                                    className={cl("modal-role-image")}
                                                    src={roleIconSrc}
                                                    alt=""
                                                />
                                            )}
                                            <Text
                                                variant="text-md/normal"
                                                className={cl("modal-list-item-text")}
                                                style={{ color: role.colorString ?? "#99aab5" }}
                                            >
                                                {role.name}
                                            </Text>
                                        </div>
                                    </div>
                                );
                            })}
                        </ScrollerThin>
                        <div className={cl("modal-divider")} />
                        <div className={cl("modal-members")}>
                            <div className={cl("modal-members-header")}>
                                <Text variant="text-md/semibold" style={{ color: selectedRole?.colorString ?? "#99aab5" }}>
                                    {selectedRole?.name} — {memberIds.length} member{memberIds.length !== 1 ? "s" : ""}
                                </Text>
                                <input
                                    type="text"
                                    className={cl("modal-members-search")}
                                    placeholder="Search members..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <ScrollerThin className={cl("modal-members-list")} orientation="auto">
                                {filteredMembers.length === 0 ? (
                                    <div className={cl("modal-members-empty")}>
                                        <Text variant="text-md/normal" style={{ color: "var(--text-muted)" }}>
                                            {searchQuery ? "No members found" : "This role has no members"}
                                        </Text>
                                    </div>
                                ) : (
                                    filteredMembers.map(({ user, member }) => {
                                        const displayName = member?.nick || user.globalName || user.username;
                                        return (
                                            <div
                                                key={user.id}
                                                className={cl("modal-member-item")}
                                                onClick={() => openUserProfileModal({ userId: user.id, guildId: guild.id })}
                                            >
                                                <img
                                                    className={cl("modal-member-avatar")}
                                                    src={user.getAvatarURL(guild.id, 32)}
                                                    alt=""
                                                />
                                                <div className={cl("modal-member-info")}>
                                                    <Text variant="text-md/semibold">{displayName}</Text>
                                                    {displayName !== user.username && (
                                                        <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                                                            {user.username}
                                                        </Text>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </ScrollerThin>
                        </div>
                    </div>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

function fetchRoleMembers(guildId: string, roleId: string): string[] {
    // Get all cached member IDs from the guild
    const allMemberIds = GuildMemberStore.getMemberIds(guildId);

    // If role is @everyone, return all cached members
    if (guildId === roleId) {
        return allMemberIds;
    }

    // Filter members who have this role
    return allMemberIds.filter(userId => {
        const member = GuildMemberStore.getMember(guildId, userId);
        return member && member.roles.includes(roleId);
    });
}

function openRoleMembersModal(guild: Guild) {
    openModal(modalProps => (
        <RoleMembersModal
            guild={guild}
            modalProps={modalProps}
        />
    ));
}

const GuildContextMenuPatch: NavContextMenuPatchCallback = (children, { guild }: { guild?: Guild; }) => {
    if (!guild) return;

    children.push(
        <Menu.MenuItem
            id="vc-role-members"
            label="Role Members (Modal)"
            action={() => openRoleMembersModal(guild)}
        />,
        <Menu.MenuItem
            id="vc-role-members-settings"
            label="Role Members (Settings)"
            action={async () => {
                await GuildSettingsActions.open(guild.id, "ROLES");
            }}
        />
    );
};

export default definePlugin({
    name: "RoleMembers",
    description: "Allows you to see all the members of a specific role via server context menu",
    authors: [Devs.hackerboi],

    contextMenus: {
        "guild-context": GuildContextMenuPatch
    }
});

