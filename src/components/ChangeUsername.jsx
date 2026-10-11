import React, { useState } from 'react';
import apiFetch from '../utils/apiFetch';
import { Edit3, AlertCircle, CheckCircle, Eye, EyeOff, Loader } from 'lucide-react';

export const ChangeUsername = ({ currentUser, onUsernameChanged }) => {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    new_username: '',
    current_password: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
    if (success) setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const trimmedUsername = formData.new_username.trim();

      // Validation
      if (!trimmedUsername) {
        setError('Please enter a new username');
        setLoading(false);
        return;
      }
      if (!formData.current_password) {
        setError('Please enter your current password');
        setLoading(false);
        return;
      }
      if (trimmedUsername.length < 3) {
        setError('Username must be at least 3 characters');
        setLoading(false);
        return;
      }
      if (trimmedUsername.length > 50) {
        setError('Username must not exceed 50 characters');
        setLoading(false);
        return;
      }
      if (trimmedUsername === currentUser.username) {
        setError('New username must be different from current username');
        setLoading(false);
        return;
      }

      // Call API
      const response = await apiFetch('/auth/change-username', {
        method: 'PUT',
        body: JSON.stringify({
          new_username: trimmedUsername,
          current_password: formData.current_password,
        }),
      });

      const responseData = await response.json();

      if (responseData.success) {
        setSuccess(true);
        setFormData({ new_username: '', current_password: '' });
        
        setTimeout(() => {
          setShowForm(false);
          setSuccess(false);
          if (onUsernameChanged) {
            onUsernameChanged(responseData.new_username);
          }
        }, 2500);
      }
    } catch (err) {
      setError(err.message || 'Failed to change username');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setFormData({ new_username: '', current_password: '' });
    setError(null);
    setSuccess(false);
  };

  if (!showForm) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p className="text-sm text-gray-600">Username</p>
          <p className="text-lg font-semibold text-gray-900">{currentUser?.username}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Change Username</h3>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Success!</p>
                <p className="text-xs text-green-700">Login again with your new username</p>
              </div>
            </div>
          )}

          {/* Current Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Username</label>
            <input
              type="text"
              value={currentUser?.username || ''}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 text-sm"
            />
          </div>

          {/* New Username */}
          <div>
            <label htmlFor="new_username" className="block text-sm font-medium text-gray-700 mb-1">
              New Username
            </label>
            <input
              id="new_username"
              type="text"
              name="new_username"
              value={formData.new_username}
              onChange={handleInputChange}
              placeholder="Enter new username"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.new_username.length} / 50 characters • Min. 3 chars
            </p>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                id="current_password"
                type={showPassword ? 'text' : 'password'}
                name="current_password"
                value={formData.current_password}
                onChange={handleInputChange}
                placeholder="Enter password"
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Required for security verification</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !formData.new_username.trim() || !formData.current_password}
              className="flex-1 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Username'
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-2.5 bg-gray-200 text-gray-800 hover:bg-gray-300 font-medium rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangeUsername;
