import React, { useState, useEffect } from 'react';
import { Grid3x3, ChevronDown, ChevronUp } from 'lucide-react';

export const PermissionsMatrix = ({ userRole, userId }) => {
  const [expandedModules, setExpandedModules] = useState({});
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);

  // Module definitions with their permissions
  const modules = [
    {
      id: 'organisation',
      name: 'Organisation & Settings',
      icon: '🏢',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Configure'],
    },
    {
      id: 'products',
      name: 'Products & Categories',
      icon: '📦',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Suspend', 'Activate', 'Price'],
    },
    {
      id: 'inventory',
      name: 'Inventory & Stock',
      icon: '📊',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Adjust', 'Transfer', 'Audit'],
    },
    {
      id: 'sales',
      name: 'Sales & Transactions',
      icon: '💳',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Cancel', 'Refund', 'Approve'],
    },
    {
      id: 'purchases',
      name: 'Purchases & Suppliers',
      icon: '🛒',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Cancel', 'Approve'],
    },
    {
      id: 'customers',
      name: 'Customers & Accounts',
      icon: '👥',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Suspend', 'Activate'],
    },
    {
      id: 'expenses',
      name: 'Expenses & Payments',
      icon: '💰',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Process', 'Refund'],
    },
    {
      id: 'financial',
      name: 'Financial & Records',
      icon: '📈',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Manage'],
    },
    {
      id: 'reports',
      name: 'Reports & Analytics',
      icon: '📋',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Generate', 'Export'],
    },
    {
      id: 'branches',
      name: 'Branches & Stores',
      icon: '🏪',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Suspend', 'Activate'],
    },
    {
      id: 'employees',
      name: 'Employees & Staff',
      icon: '👔',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Suspend', 'Activate'],
    },
    {
      id: 'users',
      name: 'User Management',
      icon: '🔑',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Assign Role', 'Reset Password'],
    },
    {
      id: 'roles',
      name: 'Roles & Permissions',
      icon: '🛡️',
      actions: ['View', 'Create', 'Edit', 'Delete', 'Assign', 'Manage'],
    },
    {
      id: 'security',
      name: 'Security & Sessions',
      icon: '🔐',
      actions: ['View', 'Configure', 'Override', 'Manage'],
    },
    {
      id: 'audit',
      name: 'Audit & Compliance',
      icon: '✓',
      actions: ['View', 'Search', 'Filter', 'Export'],
    },
    {
      id: 'backup',
      name: 'Backup & Data',
      icon: '💾',
      actions: ['View', 'Create', 'Delete', 'Restore', 'Export'],
    },
    {
      id: 'system',
      name: 'System Administration',
      icon: '⚙️',
      actions: ['View', 'Configure', 'Manage', 'Override'],
    },
  ];

  useEffect(() => {
    if (userRole === 'Director' || userRole === 'Administrator') {
      // Full admin roles have all permissions
      const allPermissions = {};
      modules.forEach((module) => {
        allPermissions[module.id] = {
          ...module,
          hasAccess: true,
          permissions: module.actions.map((action) => ({
            action,
            granted: true,
          })),
        };
      });
      setPermissions(allPermissions);
    }
  }, [userRole]);

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const getAccessColor = (granted) => {
    if (granted) return 'bg-green-100 text-green-700';
    return 'bg-red-100 text-red-700';
  };

  const getAccessIcon = (granted) => {
    return granted ? '✓' : '✕';
  };

  if (userRole !== 'Director' && userRole !== 'Administrator') {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Grid3x3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Permissions matrix is only visible to full admin roles</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
        <div className="flex items-center gap-3">
          <Grid3x3 className="w-6 h-6" />
          <div>
            <h2 className="text-2xl font-bold">Permissions Matrix</h2>
            <p className="text-red-100 text-sm">Director - Full Access Enabled</p>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4">
          {modules.map((module) => {
            const isExpanded = expandedModules[module.id];
            const modulePerms = permissions[module.id];

            return (
              <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Module Header */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <span className="text-2xl">{module.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{module.name}</h3>
                      <p className="text-xs text-gray-600">
                        {module.actions.length} actions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-bold px-3 py-1 rounded-full ${
                        (userRole === 'Director' || userRole === 'Administrator')
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {(userRole === 'Director' || userRole === 'Administrator') ? '✓ Granted' : '✕ Denied'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                </button>

                {/* Module Actions - Expanded View */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {module.actions.map((action) => (
                        <div
                          key={`${module.id}-${action}`}
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              (userRole === 'Director' || userRole === 'Administrator')
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {(userRole === 'Director' || userRole === 'Administrator') ? '✓' : '✕'}
                          </div>
                          <span className="text-gray-900 font-medium">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
          <h3 className="font-bold text-gray-900 mb-2">Access Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Modules</p>
              <p className="text-2xl font-bold text-green-600">{modules.length}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Actions</p>
              <p className="text-2xl font-bold text-green-600">
                {modules.reduce((sum, m) => sum + m.actions.length, 0)}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Access Level</p>
              <p className="text-2xl font-bold text-blue-600">FULL</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Authority</p>
              <p className="text-2xl font-bold text-purple-600">Level 100</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsMatrix;
