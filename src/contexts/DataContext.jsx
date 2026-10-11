import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { AuthContext, apiFetch } from './AuthContext';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const { isLoggedIn, isInitialized, currentUser } = useContext(AuthContext);

  const [stats, setStats] = useState({});
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [disposals, setDisposals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  
  const [dbStatus, setDbStatus] = useState('Connecting...');
  const [usingFallback, setUsingFallback] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState('');
  const [retryCountdown, setRetryCountdown] = useState(10);
  
  const retryIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const clearLiveData = () => {
    setStats({});
    setMaterials([]); setCategories([]); setSuppliers([]); setEmployees([]);
    setTransactions([]); setTransfers([]); setDisposals([]); setRequests([]); setAuditLogs([]); setUsersList([]);
    setSystemSettings({});
  };
  const fetchSystemSettings = async () => {
    if (!isInitialized || !isLoggedIn) return;
    try {
      const res = await apiFetch('/system-settings');
      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
      }
    } catch (e) {
      console.warn('Could not fetch system settings:', e.message);
    }
  };

  useEffect(() => {
    if (!isInitialized || !isLoggedIn) return undefined;
    window.addEventListener('system_settings_updated', fetchSystemSettings);
    return () => window.removeEventListener('system_settings_updated', fetchSystemSettings);
  }, [isInitialized, isLoggedIn]);

  useEffect(() => {
    const handleOnline = () => {
      if (isInitialized && isLoggedIn) fetchData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isInitialized, isLoggedIn]);

  useEffect(() => {
    if (apiError && isLoggedIn) {
      setRetryCountdown(10);
      countdownRef.current = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) return 10;
          return prev - 1;
        });
      }, 1000);
      retryIntervalRef.current = setInterval(() => {
        fetchData();
      }, 10000);
    } else {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [apiError, isLoggedIn]);

  const initialLoadDone = useRef(false);
  const fetchingRef = useRef(false); // ✅ PREVENT OVERLAPPING CALLS
  const queuedRefreshRef = useRef(false);

  const fetchData = async (forceAll = true) => {
    if (!isInitialized || !isLoggedIn || !currentUser) return;
    
    // Keep the latest refresh request instead of dropping it while a fetch is active.
    if (fetchingRef.current) {
      queuedRefreshRef.current = queuedRefreshRef.current || forceAll;
      return;
    }
    
    fetchingRef.current = true;
    try {
      if (!initialLoadDone.current || forceAll) {
        fetchSystemSettings();
      }

      const statusRes = await apiFetch('/system/status').catch((err) => {
        setApiErrorMessage(err?.message || 'Unable to reach backend server');
        return null;
      });
      if (!statusRes || !statusRes.ok) {
        let message = 'Backend server is not reachable';
        if (statusRes) {
          try {
            const errBody = await statusRes.json();
            message = errBody?.error || errBody?.message || `${statusRes.status} ${statusRes.statusText}`.trim();
          } catch {
            message = `${statusRes.status} ${statusRes.statusText}`.trim();
          }
        }
        setApiError(true);
        setApiErrorMessage(message || 'Backend server is not reachable');
        setDbStatus('Server Offline - live data unavailable');
        clearLiveData();
        return;
      }
      
      const statusData = await statusRes.json();
      setUsingFallback(Boolean(statusData.usingFallback));
      setDbStatus(statusData.usingFallback ? 'Resilient Local Mode' : 'MySQL Connected');

      // ✅ ALWAYS FETCH DYNAMIC DATA (for lightweight polling)
      const resStatsP = apiFetch('/dashboard/stats')
        .then(r => {
          if (!r.ok) throw new Error(`Dashboard stats failed: ${r.status} ${r.statusText}`);
          return r.json();
        })
        .catch(err => {
          console.warn('Error fetching dashboard stats:', err.message);
          return null;
        });

      const resMatsP = apiFetch('/materials')
        .then(r => {
          if (!r.ok) throw new Error(`Materials fetch failed: ${r.status} ${r.statusText}`);
          return r.json();
        })
        .catch(err => {
          console.warn('Error fetching materials:', err.message);
          return null;
        });

      const resEmpsP = apiFetch('/employees')
        .then(r => {
          if (!r.ok) throw new Error(`Employees fetch failed: ${r.status}`);
          return r.json();
        })
        .catch(err => {
          console.warn('Error fetching employees:', err.message);
          return null;
        });

      const resSupsP = apiFetch('/suppliers')
        .then(r => {
          if (!r.ok) throw new Error(`Suppliers fetch failed: ${r.status}`);
          return r.json();
        })
        .catch(err => {
          console.warn('Error fetching suppliers:', err.message);
          return null;
        });

      const resCatsP = apiFetch('/categories')
        .then(r => {
          if (!r.ok) throw new Error(`Categories fetch failed: ${r.status}`);
          return r.json();
        })
        .catch(err => {
          console.warn('Error fetching categories:', err.message);
          return null;
        });

      // ✅ WAIT FOR ALL BASIC DATA
      const [resStats, resMats, resEmps, reSups, reCats] = await Promise.all([resStatsP, resMatsP, resEmpsP, resSupsP, resCatsP]);

      setApiError(false);
      setApiErrorMessage('');

      if (resStats && !resStats.error) setStats(resStats);
      if (resMats && !resMats.error) {
        if (Array.isArray(resMats)) setMaterials(resMats);
        else if (resMats.data && Array.isArray(resMats.data)) setMaterials(resMats.data);
      } else if (resMats?.error) {
        console.warn('Materials API error:', resMats.error);
      }
      if (resEmps && !resEmps.error) {
        if (Array.isArray(resEmps)) setEmployees(resEmps);
        else if (resEmps.data && Array.isArray(resEmps.data)) setEmployees(resEmps.data);
      }
      if (reSups && !reSups.error) {
        if (Array.isArray(reSups)) setSuppliers(reSups);
        else if (reSups.data && Array.isArray(reSups.data)) setSuppliers(reSups.data);
      }
      if (reCats && !reCats.error) {
        if (Array.isArray(reCats)) setCategories(reCats);
        else if (reCats.data && Array.isArray(reCats.data)) setCategories(reCats.data);
      }

      // ✅ FETCH HISTORICAL/STATIC DATA ONLY ON FULL REFRESH (don't duplicate)
      if (forceAll || !initialLoadDone.current) {
        // Transactions, Transfers, Disposals, Audit Logs, Users (only once on full refresh)
        const resUsers = await apiFetch('/users')
          .then(r => {
            if (!r.ok) throw new Error(`Users fetch failed: ${r.status}`);
            return r.json();
          })
          .catch(err => {
            console.warn('Error fetching users:', err.message);
            return null;
          });
        if (resUsers && !resUsers.error) {
          if (Array.isArray(resUsers)) setUsersList(resUsers);
          else if (resUsers.data && Array.isArray(resUsers.data)) setUsersList(resUsers.data);
        }

        // Heavy Historical Data - fetched sequentially to avoid locking DB
        const resTxs = await apiFetch('/transactions')
          .then(r => {
            if (!r.ok) throw new Error(`Transactions fetch failed: ${r.status}`);
            return r.json();
          })
          .catch(err => {
            console.warn('Error fetching transactions:', err.message);
            return null;
          });
        if (resTxs && !resTxs.error) {
          if (resTxs.data) setTransactions(resTxs.data);
          else if (Array.isArray(resTxs)) setTransactions(resTxs);
        }

        const resTrfs = await apiFetch('/transfers')
          .then(r => {
            if (!r.ok) throw new Error(`Transfers fetch failed: ${r.status}`);
            return r.json();
          })
          .catch(err => {
            console.warn('Error fetching transfers:', err.message);
            return null;
          });
        if (resTrfs && !resTrfs.error) {
          if (resTrfs.data) setTransfers(resTrfs.data);
          else if (Array.isArray(resTrfs)) setTransfers(resTrfs);
        }

        const resDisps = await apiFetch('/disposals')
          .then(r => {
            if (!r.ok) throw new Error(`Disposals fetch failed: ${r.status}`);
            return r.json();
          })
          .catch(err => {
            console.warn('Error fetching disposals:', err.message);
            return null;
          });
        if (resDisps && !resDisps.error) {
          if (resDisps.data) setDisposals(resDisps.data);
          else if (Array.isArray(resDisps)) setDisposals(resDisps);
        }

        const resReqs = await apiFetch('/material-requests')
          .then(r => {
            if (!r.ok) throw new Error(`Material requests fetch failed: ${r.status}`);
            return r.json();
          })
          .catch(err => {
            console.warn('Error fetching material requests:', err.message);
            return null;
          });
        if (resReqs && !resReqs.error) {
          if (resReqs.data) setRequests(resReqs.data);
          else if (Array.isArray(resReqs)) setRequests(resReqs);
        }

        if (currentUser?.role !== 'Employee') {
          const resLogs = await apiFetch('/audit-logs')
            .then(r => {
              if (!r.ok) throw new Error(`Audit logs fetch failed: ${r.status}`);
              return r.json();
            })
            .catch(err => {
              console.warn('Error fetching audit logs:', err.message);
              return null;
            });
          if (resLogs && !resLogs.error) {
            if (resLogs.data) setAuditLogs(resLogs.data);
            else if (Array.isArray(resLogs)) setAuditLogs(resLogs);
          }
        }

        initialLoadDone.current = true;
      }
    } catch (e) {
      console.warn('API fetch error:', e.message);
      setApiError(true);
      setApiErrorMessage(e.message || 'Unknown API error');
      setDbStatus('Server Offline - live data unavailable');
      clearLiveData();
      initialLoadDone.current = false;
    } finally {
      // ✅ ALWAYS RESET FETCHING FLAG
      fetchingRef.current = false;
      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false;
        setTimeout(() => fetchData(true), 0);
      }
    }
  };

  useEffect(() => {
    if (isInitialized && isLoggedIn && currentUser) {
      fetchData(true);
      const interval = setInterval(() => fetchData(false), 5000);

      return () => clearInterval(interval);
    } else {
      // ✅ USER LOGGED OUT — CLEAR ALL LIVE DATA AND STOP RETRIES
      clearLiveData();
      setApiError(false);
      setApiErrorMessage('');
      setDbStatus('Connecting...');
      fetchingRef.current = false; // ✅ RESET FETCHING FLAG
      initialLoadDone.current = false;
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [isInitialized, isLoggedIn, currentUser]);

  // Actions
  const handleAddMaterial = async (matData) => {
    try {
      const response = await apiFetch('/materials', { method: 'POST', body: JSON.stringify(matData) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to register material');
      }
      fetchData(true);
      return null;
    } catch (e) {
      console.error(e);
      return e.message || 'Failed to register material';
    }
  };

  const handleEditMaterial = async (id, matData) => {
    try {
      const response = await apiFetch(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(matData) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update material (${response.status})`);
      }
      fetchData(true);
      return null;
    } catch (e) {
      console.error('Edit material error:', e.message);
      return e.message || 'Failed to update material';
    }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      const response = await apiFetch(`/materials/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete material (${response.status})`);
      }
      fetchData(true);
      return null;
    } catch (e) {
      console.error('Delete material error:', e.message);
      return e.message || 'Failed to delete material';
    }
  };

  const handleStockIn = async (data) => {
    try {
      const res = await apiFetch('/inventory/stock-in', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Stock in failed (${res.status})`);
      }
      fetchData(true);
      return await res.json();
    } catch (e) {
      console.error('Stock in error:', e.message);
      throw e;
    }
  };

  const handleStockOut = async (data) => {
    try {
      const res = await apiFetch('/inventory/stock-out', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Stock out failed (${res.status})`);
      }
      fetchData(true);
      return await res.json();
    } catch (e) {
      console.error('Stock out error:', e.message);
      throw e;
    }
  };

  const handleReturn = async (data) => {
    try {
      const res = await apiFetch('/inventory/return', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Return failed (${res.status})`);
      }
      fetchData(true);
      return null;
    } catch (e) {
      console.error('Return error:', e.message);
      throw e;
    }
  };

  const handleAdjust = async (data) => {
    try {
      const res = await apiFetch('/inventory/adjust', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Adjustment failed (${res.status})`);
      }
      fetchData(true);
      return null;
    } catch (e) {
      console.error('Adjust error:', e.message);
      throw e;
    }
  };

  const handleTransfer = async (data) => {
    try {
      const res = await apiFetch('/transfers', { method: 'POST', body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      fetchData(true);
      return null;
    } catch (e) { return e.message; }
  };

  const handleAddEmployee = async (empData) => {
    try {
      const response = await apiFetch('/employees', { method: 'POST', body: JSON.stringify(empData) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to add employee (${response.status})`);
      }
      fetchData(true);
      return null;
    } catch (e) {
      console.error('Add employee error:', e.message);
      return e.message || 'Failed to add employee';
    }
  };

  const handleAddSupplier = async (supData) => {
    try {
      const response = await apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(supData) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to add supplier (${response.status})`);
      }
      fetchData();
      return null;
    } catch (e) {
      console.error('Add supplier error:', e.message);
      return e.message || 'Failed to add supplier';
    }
  };

  const handleAddUser = async (userData) => {
    try {
      const res = await apiFetch('/users', { method: 'POST', body: JSON.stringify(userData) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return data?.error || data?.message || `Unable to create user (${res.status})`;
      }
      fetchData();
      return null;
    } catch (e) {
      console.error(e);
      return e.message || 'Unable to reach backend server';
    }
  };

  return (
    <DataContext.Provider value={{
      stats, materials, categories, suppliers, employees,
      transactions, transfers, disposals, requests, auditLogs, usersList,
      systemSettings, dbStatus, usingFallback, apiError,
      apiErrorMessage, retryCountdown, fetchData, setRetryCountdown,
      handleAddMaterial, handleEditMaterial, handleDeleteMaterial,
      handleStockIn, handleStockOut, handleReturn, handleAdjust,
      handleTransfer, handleAddEmployee, handleAddSupplier, handleAddUser
    }}>
      {children}
    </DataContext.Provider>
  );
};


