import React from 'react';
import { Shield, Star, AlertCircle } from 'lucide-react';

/**
 * RoleBadge Component
 * Displays role information with styled badge based on role type
 * Director gets special styling with crown icon and red background
 */
export const RoleBadge = ({ role, showAccessLevel = false, showAuthority = false, size = 'md' }) => {
  if (!role) return null;

  // Role configuration with colors and icons
  const roleConfig = {
    'Director': {
      bg: 'bg-red-600',
      hoverBg: 'hover:bg-red-700',
      text: 'text-white',
      border: 'border-red-600',
      light: 'bg-red-50',
      lightText: 'text-red-700',
      icon: Shield,
      authority: 95,
      accessLevel: 'FULL_ACCESS',
      tag: 'ADMIN',
      description: 'Full administrative access and control',
    },
    'Administrator': {
      bg: 'bg-amber-600',
      hoverBg: 'hover:bg-amber-700',
      text: 'text-white',
      border: 'border-amber-600',
      light: 'bg-amber-50',
      lightText: 'text-amber-700',
      icon: Shield,
      authority: 80,
      accessLevel: 'ADMIN_ACCESS',
      tag: 'ADMIN',
      description: 'Full administrative access to system',
    },
    'Manager': {
      bg: 'bg-blue-600',
      hoverBg: 'hover:bg-blue-700',
      text: 'text-white',
      border: 'border-blue-600',
      light: 'bg-blue-50',
      lightText: 'text-blue-700',
      icon: Star,
      authority: 60,
      accessLevel: 'MANAGER_ACCESS',
      tag: 'MANAGER',
      description: 'Management authority over store operations',
    },
    'Storekeeper': {
      bg: 'bg-teal-600',
      hoverBg: 'hover:bg-teal-700',
      text: 'text-white',
      border: 'border-teal-600',
      light: 'bg-teal-50',
      lightText: 'text-teal-700',
      icon: Star,
      authority: 40,
      accessLevel: 'STAFF_ACCESS',
      tag: 'STAFF',
      description: 'Store operations staff',
    },
    'Employee': {
      bg: 'bg-gray-500',
      hoverBg: 'hover:bg-gray-600',
      text: 'text-white',
      border: 'border-gray-500',
      light: 'bg-gray-100',
      lightText: 'text-gray-700',
      icon: AlertCircle,
      authority: 20,
      accessLevel: 'BASIC_ACCESS',
      tag: 'EMPLOYEE',
      description: 'Basic employee access',
    },
  };

  const config = roleConfig[role] || {
    bg: 'bg-gray-400',
    hoverBg: 'hover:bg-gray-500',
    text: 'text-white',
    border: 'border-gray-400',
    light: 'bg-gray-100',
    lightText: 'text-gray-600',
    icon: AlertCircle,
    authority: 0,
    accessLevel: 'UNKNOWN',
    tag: 'USER',
    description: 'Unknown role',
  };

  const Icon = config.icon;

  // Determine size classes
  const sizeClasses = {
    xs: {
      badge: 'px-2 py-1 text-xs',
      icon: 'w-3 h-3',
      gap: 'gap-1',
    },
    sm: {
      badge: 'px-2.5 py-1.5 text-sm',
      icon: 'w-4 h-4',
      gap: 'gap-1.5',
    },
    md: {
      badge: 'px-3 py-2 text-sm',
      icon: 'w-5 h-5',
      gap: 'gap-2',
    },
    lg: {
      badge: 'px-4 py-2.5 text-base',
      icon: 'w-6 h-6',
      gap: 'gap-2.5',
    },
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Compact Badge (default)
  if (!showAccessLevel && !showAuthority) {
    return (
      <span
        className={`inline-flex items-center ${sizeClass.gap} font-semibold rounded-full ${config.bg} ${config.text} ${sizeClass.badge} whitespace-nowrap`}
      >
        <Icon className={sizeClass.icon} />
        {role}
      </span>
    );
  }

  // Extended Badge with Access Level and Authority
  return (
    <div className={`inline-flex flex-col gap-1 ${config.light} ${config.lightText} p-3 rounded-lg border ${config.border}`}>
      <div className={`inline-flex items-center ${sizeClass.gap} font-bold`}>
        <Icon className={sizeClass.icon} />
        {role}
      </div>
      {showAccessLevel && (
        <div className="text-xs font-medium opacity-90">
          Access: <span className="font-bold">{config.accessLevel}</span>
        </div>
      )}
      {showAuthority && (
        <div className="text-xs font-medium opacity-90">
          Authority: <span className="font-bold">Level {config.authority}</span>
        </div>
      )}
    </div>
  );
};

/**
 * RoleBadgeCompact Component
 * Minimal inline badge for lists and tables
 */
export const RoleBadgeCompact = ({ role }) => {
  return <RoleBadge role={role} size="sm" />;
};

/**
 * RoleBadgeExpanded Component
 * Full badge with access level and authority
 */
export const RoleBadgeExpanded = ({ role }) => {
  return <RoleBadge role={role} size="md" showAccessLevel showAuthority />;
};

export default RoleBadge;
