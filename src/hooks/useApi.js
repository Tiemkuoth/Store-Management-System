import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './useToast';
import { apiFetch } from '../utils/apiFetch';

/**
 * Custom hook for GET requests with React Query
 */
export const useApiQuery = (key, endpoint, options = {}) => {
  const { showToast } = useToast();

  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      const response = await apiFetch(endpoint);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.error || 'Request failed');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    retry: 1,
    onError: (error) => {
      showToast(`Error: ${error.message}`, 'error');
    },
    ...options,
  });
};

/**
 * Custom hook for POST requests
 */
export const useApiMutation = (options = {}) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (variables) => {
      const { endpoint, method = 'POST', data, ...config } = variables;
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(data),
        ...config,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.error || 'Request failed');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate queries based on endpoint
      const endpoint = variables.endpoint.split('/')[1]; // Get first part of endpoint
      queryClient.invalidateQueries({ queryKey: [endpoint] });

      if (variables.successMessage) {
        showToast(variables.successMessage, 'success');
      }

      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    onError: (error, variables) => {
      showToast(`Error: ${error.message}`, 'error');
      if (options.onError) {
        options.onError(error, variables);
      }
    },
  });
};

/**
 * Custom hook for fetching paginated data
 */
export const usePaginatedQuery = (key, endpoint, options = {}) => {
  const { page = 1, limit = 10, search = '', sort = '', order = 'desc', ...queryOpts } = options;

  const queryParams = new URLSearchParams({
    page,
    limit,
    ...(search && { search }),
    ...(sort && { sort, order }),
  });

  return useApiQuery(
    [key, page, limit, search, sort, order],
    `${endpoint}?${queryParams.toString()}`,
    queryOpts
  );
};

/**
 * Custom hook for cached data that updates in background
 */
export const useCachedQuery = (key, endpoint, options = {}) => {
  return useApiQuery(key, endpoint, {
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    ...options,
  });
};
