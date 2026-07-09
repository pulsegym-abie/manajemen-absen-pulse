'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  RefreshCw, 
  LogOut, 
  Share2, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  User, 
  Check, 
  Layers, 
  X, 
  Clock, 
  FileText, 
  Filter, 
  Briefcase,
  AlertCircle,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type User as FirebaseUser } from 'firebase/auth';

import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from '@/lib/firebase';
import { 
  createNewSpreadsheet, 
  fetchShifts, 
  syncShifts, 
  type Shift 
} from '@/lib/googleSheets';

// Define divisions styled with exact iOS style colors
interface DivisionOption {
  key: string;
  label: string;
  color: string;
  textClass: string;
  bgClass: string;
  dotColor: string;
}

const DIVISIONS: DivisionOption[] = [
  { key: 'Front Office', label: 'Front Office', color: '#007aff', textClass: 'text-[#007aff]', bgClass: 'bg-[#007aff]/10', dotColor: 'bg-[#007aff]' },
  { key: 'Back Office', label: 'Back Office', color: '#34c759', textClass: 'text-[#34c759]', bgClass: 'bg-[#34c759]/10', dotColor: 'bg-[#34c759]' },
  { key: 'Security', label: 'Security', color: '#ff3b30', textClass: 'text-[#ff3b30]', bgClass: 'bg-[#ff3b30]/10', dotColor: 'bg-[#ff3b30]' },
  { key: 'Kitchen', label: 'Kitchen', color: '#ff9500', textClass: 'text-[#ff9500]', bgClass: 'bg-[#ff9500]/10', dotColor: 'bg-[#ff9500]' },
  { key: 'IT Support', label: 'IT Support', color: '#5856d6', textClass: 'text-[#5856d6]', bgClass: 'bg-[#5856d6]/10', dotColor: 'bg-[#5856d6]' }
];

const SHIFT_PRESETS = [
  { name: 'Pagi', time: '07:00 - 15:00' },
  { name: 'Siang', time: '15:00 - 23:00' },
  { name: 'Malam', time: '23:00 - 07:00' },
  { name: 'Middle', time: '11:00 - 19:00' },
  { name: 'Off', time: 'Libur' }
];

export default function ShiftCalendarPage() {
  // Authentication & Google API Token State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sheets Sync State
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [manualSheetId, setManualSheetId] = useState('');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Shifts Data
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  // Interactive View States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'Bulan' | 'Daftar' | 'Divisi'>('Bulan');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState<string>('Semua');

  // Dynamic iOS clock state
  const [currentTime, setCurrentTime] = useState('09:41');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateClock = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setCurrentTime(`${hours}:${minutes}`);
      };
      updateClock();
      const interval = setInterval(updateClock, 30000); // update every 30s
      return () => clearInterval(interval);
    }
  }, []);

  // Modal Sheet State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  
  // Form Fields
  const [formEmployee, setFormEmployee] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDivision, setFormDivision] = useState('Front Office');
  const [formShiftName, setFormShiftName] = useState('Pagi');
  const [formTime, setFormTime] = useState('07:00 - 15:00');
  const [formNotes, setFormNotes] = useState('');

  // Toast status
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Google Sheet Loader
  const loadShiftsData = useCallback(async (targetSheetId: string, token: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const fetched = await fetchShifts(targetSheetId, token);
      setShifts(fetched);
    } catch (err: any) {
      console.error('Error fetching shifts:', err);
      setSyncError('Gagal memuat jadwal dari Google Sheets. Pastikan ID Spreadsheet benar dan Anda memiliki akses.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Setup initial token verification and sheet id detection
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setTimeout(() => {
          setNeedsAuth(false);
        }, 0);
      },
      () => {
        setTimeout(() => {
          setNeedsAuth(true);
        }, 0);
      }
    );

    // Read sheetId from URL query or localStorage
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const idFromUrl = params.get('sheetId');
      if (idFromUrl) {
        setTimeout(() => {
          setSheetId(idFromUrl);
        }, 0);
        localStorage.setItem('shift_spreadsheet_id', idFromUrl);
      } else {
        const idFromStorage = localStorage.getItem('shift_spreadsheet_id');
        if (idFromStorage) {
          setTimeout(() => {
            setSheetId(idFromStorage);
          }, 0);
        }
      }
    }

    return () => unsubscribe();
  }, []);

  // Fetch shifts when sheetId and accessToken are available
  useEffect(() => {
    if (sheetId && accessToken) {
      setTimeout(() => {
        loadShiftsData(sheetId, accessToken);
      }, 0);
    }
  }, [sheetId, accessToken, loadShiftsData]);

  // Google Sign In Handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setAccessToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        triggerToast('Sign in berhasil!');
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setSyncError('Gagal masuk ke Google. Pastikan pop-up diizinkan.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign Out Handler
  const handleLogout = async () => {
    if (window.confirm('Apakah Anda yakin ingin keluar?')) {
      await logout();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      triggerToast('Anda telah keluar.');
    }
  };

  // Create a brand new Spreadsheet
  const handleCreateSheet = async () => {
    if (!accessToken) return;
    setIsCreatingSheet(true);
    setSyncError(null);
    try {
      const title = `Jadwal Shift Tim Kerja - ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
      const newId = await createNewSpreadsheet(title, accessToken);
      setSheetId(newId);
      localStorage.setItem('shift_spreadsheet_id', newId);
      
      // Update browser URL query without reloading
      const url = new URL(window.location.href);
      url.searchParams.set('sheetId', newId);
      window.history.pushState({}, '', url.toString());

      setShifts([]); // Brand new sheet starts empty
      triggerToast('Google Sheet baru berhasil dibuat!');
    } catch (err: any) {
      console.error('Create sheet failed:', err);
      setSyncError('Gagal membuat Google Sheet baru di Drive Anda.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Connect to an existing Spreadsheet manually
  const handleConnectSheet = () => {
    if (!manualSheetId.trim()) return;
    
    let targetId = manualSheetId.trim();
    // Support full spreadsheet URL parsing
    if (targetId.includes('docs.google.com/spreadsheets')) {
      const matches = targetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (matches && matches[1]) {
        targetId = matches[1];
      }
    }

    setSheetId(targetId);
    localStorage.setItem('shift_spreadsheet_id', targetId);

    // Update URL query
    const url = new URL(window.location.href);
    url.searchParams.set('sheetId', targetId);
    window.history.pushState({}, '', url.toString());

    setManualSheetId('');
    triggerToast('Berhasil menghubungkan Google Sheet!');
  };

  // Disconnect Sheet
  const handleDisconnectSheet = () => {
    if (window.confirm('Apakah Anda yakin ingin melepas tautan Google Sheet ini dari perangkat Anda?')) {
      setSheetId(null);
      setShifts([]);
      localStorage.removeItem('shift_spreadsheet_id');
      const url = new URL(window.location.href);
      url.searchParams.delete('sheetId');
      window.history.pushState({}, '', url.toString());
      triggerToast('Tautan Google Sheet dilepas.');
    }
  };

  // Manual Trigger to Refresh data
  const handleRefresh = async () => {
    if (!sheetId || !accessToken) return;
    await loadShiftsData(sheetId, accessToken);
    triggerToast('Jadwal diperbarui dari Google Sheets.');
  };

  // Copy Shareable Link to Clipboard
  const handleCopyShareLink = () => {
    if (!sheetId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?sheetId=${sheetId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareSuccess(true);
      triggerToast('Link bagikan berhasil disalin!');
      setTimeout(() => setShareSuccess(false), 3000);
    });
  };

  // Initialize and open form for new shift
  const handleOpenAddForm = () => {
    setEditingShift(null);
    setFormEmployee('');
    setFormRole('');
    // Format: YYYY-MM-DD in local timezone
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    setFormDate(`${year}-${month}-${day}`);
    setFormDivision('Front Office');
    setFormShiftName('Pagi');
    setFormTime('07:00 - 15:00');
    setFormNotes('');
    setShowFormModal(true);
  };

  // Open form for editing existing shift
  const handleOpenEditForm = (shift: Shift) => {
    setEditingShift(shift);
    setFormEmployee(shift.employee);
    setFormRole(shift.role);
    setFormDate(shift.date);
    setFormDivision(shift.division);
    setFormShiftName(shift.shiftName);
    setFormTime(shift.time);
    setFormNotes(shift.notes);
    setShowFormModal(true);
  };

  // Handle Shift Presets preset changes
  const handlePresetChange = (presetName: string) => {
    setFormShiftName(presetName);
    const preset = SHIFT_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setFormTime(preset.time);
    }
  };

  // Submit Form (Add or Edit) and sync directly to Sheet
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployee.trim()) {
      alert('Nama karyawan harus diisi.');
      return;
    }
    if (!formDate) {
      alert('Tanggal shift harus ditentukan.');
      return;
    }

    let updatedShifts = [...shifts];

    if (editingShift) {
      // Editing
      updatedShifts = updatedShifts.map((s) => 
        s.id === editingShift.id 
          ? {
              ...s,
              employee: formEmployee,
              role: formRole,
              date: formDate,
              division: formDivision,
              shiftName: formShiftName,
              time: formTime,
              notes: formNotes,
            }
          : s
      );
    } else {
      // Adding new
      const newShift: Shift = {
        id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        employee: formEmployee,
        role: formRole,
        date: formDate,
        division: formDivision,
        shiftName: formShiftName,
        time: formTime,
        notes: formNotes,
      };
      updatedShifts.push(newShift);
    }

    // Pessimistic sync update
    setIsSyncing(true);
    try {
      if (sheetId && accessToken) {
        await syncShifts(sheetId, updatedShifts, accessToken);
        setShifts(updatedShifts);
        setShowFormModal(false);
        triggerToast(editingShift ? 'Shift berhasil diperbarui!' : 'Shift baru berhasil disimpan!');
      } else {
        alert('Tautan Google Sheet hilang.');
      }
    } catch (err: any) {
      console.error('Failed to sync changes:', err);
      alert(`Gagal menyimpan perubahan ke Google Sheets: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Destructive Delete handler with mandatory confirmation
  const handleDeleteShift = async () => {
    if (!editingShift) return;

    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus jadwal shift untuk ${editingShift.employee} (${editingShift.shiftName}) pada tanggal ${editingShift.date}? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    const updatedShifts = shifts.filter((s) => s.id !== editingShift.id);

    setIsSyncing(true);
    try {
      if (sheetId && accessToken) {
        await syncShifts(sheetId, updatedShifts, accessToken);
        setShifts(updatedShifts);
        setShowFormModal(false);
        triggerToast('Shift berhasil dihapus dari Google Sheets.');
      }
    } catch (err: any) {
      console.error('Failed to delete shift:', err);
      alert(`Gagal menghapus shift dari Google Sheets: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // CALENDAR DATA UTILS
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday is 0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const daysList = [];

    // Prev Month Days
    for (let i = 0; i < firstDayIndex; i++) {
      const dayNum = prevTotalDays - firstDayIndex + i + 1;
      daysList.push({
        day: dayNum,
        isCurrentMonth: false,
        date: new Date(year, month - 1, dayNum)
      });
    }

    // Current Month Days
    for (let i = 1; i <= totalDays; i++) {
      daysList.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      });
    }

    // Next Month Days to complete 42 cells grid
    const totalCells = 42;
    const remaining = totalCells - daysList.length;
    for (let i = 1; i <= remaining; i++) {
      daysList.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      });
    }

    return daysList;
  }, [viewMonth]);

  // Navigate calendar month
  const prevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const setToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setViewMonth(today);
  };

  // Filter and Search shifts logic
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      // Matches Search Query
      const matchesSearch = 
        shift.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shift.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shift.notes.toLowerCase().includes(searchQuery.toLowerCase());

      // Matches Division filter
      const matchesDivision = filterDivision === 'Semua' || shift.division === filterDivision;

      return matchesSearch && matchesDivision;
    });
  }, [shifts, searchQuery, filterDivision]);

  // Get shifts specifically for the currently selected date
  const selectedDateShifts = useMemo(() => {
    const formattedSelected = selectedDate.toISOString().split('T')[0];
    return filteredShifts.filter((shift) => shift.date === formattedSelected);
  }, [filteredShifts, selectedDate]);

  // Check if a date has shifts for drawing color dots on the calendar cells
  const getDayDivisions = useCallback((date: Date) => {
    const formatted = date.toISOString().split('T')[0];
    const dayShifts = shifts.filter((s) => s.date === formatted);
    
    // Return unique division keys active on this day
    const uniqueDivs = Array.from(new Set(dayShifts.map((s) => s.division)));
    return DIVISIONS.filter((div) => uniqueDivs.includes(div.key));
  }, [shifts]);

  // Group division statistics for the stats/divisions tab
  const divisionStats = useMemo(() => {
    const stats: Record<string, { count: number; hours: number; employees: Set<string> }> = {};
    
    DIVISIONS.forEach((div) => {
      stats[div.key] = { count: 0, hours: 0, employees: new Set() };
    });

    shifts.forEach((shift) => {
      if (stats[shift.division]) {
        stats[shift.division].count += 1;
        stats[shift.division].employees.add(shift.employee);
        
        // Approximate hours estimation
        if (shift.time.includes('-')) {
          const parts = shift.time.split('-');
          if (parts.length === 2) {
            const startHour = parseInt(parts[0].split(':')[0]);
            const endHour = parseInt(parts[1].split(':')[0]);
            if (!isNaN(startHour) && !isNaN(endHour)) {
              let diff = endHour - startHour;
              if (diff < 0) diff += 24; // Handle overnight shifts
              stats[shift.division].hours += diff;
            }
          }
        } else if (shift.shiftName !== 'Off') {
          stats[shift.division].hours += 8; // Standard 8 hours
        }
      }
    });

    return stats;
  }, [shifts]);

  // SETUP RENDER
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] dark:bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden p-8 border border-zinc-100 dark:border-zinc-800 text-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#007aff] to-[#5856d6] rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/10 mb-6">
            <CalendarIcon className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-white mb-2">
            Shift Team Calendar
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed">
            Manajemen shift kerja tim yang tersinkronisasi real-time dengan Google Sheets. Desain Cupertino yang intuitif dan mudah digunakan.
          </p>

          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 py-3.5 px-4 rounded-xl shadow-sm text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Menghubungkan...' : 'Sign in dengan Google'}</span>
            </button>
            
            {syncError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl text-left border border-red-100 dark:border-red-900/30">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
            Aplikasi ini memerlukan izin Google Sheets & Drive untuk membaca dan menulis jadwal secara real-time.
          </div>
        </div>
      </div>
    );
  }

  // SHEETS SETUP INTERFACE (Authenticated but no Sheet Linked)
  if (!sheetId) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] dark:bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden p-8 border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-[#007aff]">
                {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'US'}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-950 dark:text-white leading-tight">{user?.displayName}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-500 transition-colors duration-200"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-bold font-display tracking-tight text-zinc-950 dark:text-white mb-2">
              Hubungkan Jadwal Shift
            </h2>
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">
              Untuk memulai, Anda dapat membuat file spreadsheet baru atau menautkan spreadsheet Google Sheets yang sudah ada.
            </p>
          </div>

          <div className="space-y-6">
            {/* Option A: Create Spreadsheet */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-zinc-900 dark:to-zinc-850 p-5 rounded-2xl border border-blue-100/50 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-950 dark:text-white text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#007aff]/10 text-[#007aff] flex items-center justify-center text-xs font-bold">1</span>
                Buat Spreadsheet Baru
              </h3>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs mb-4">
                Sistem akan membuat file Google Sheets baru secara otomatis di Google Drive Anda sebagai media database shift.
              </p>
              <button
                onClick={handleCreateSheet}
                disabled={isCreatingSheet}
                className="w-full py-3 px-4 bg-[#007aff] hover:bg-[#0062cc] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white font-medium text-sm rounded-xl shadow-md shadow-blue-500/10 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isCreatingSheet ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sedang Membuat...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Buat Spreadsheet Jadwal</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-zinc-400 text-xs font-medium uppercase tracking-wider">ATAU</span>
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
            </div>

            {/* Option B: Link existing Spreadsheet */}
            <div>
              <h3 className="font-semibold text-zinc-950 dark:text-white text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center text-xs font-bold">2</span>
                Hubungkan Spreadsheet yang Ada
              </h3>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs mb-3">
                Masukkan ID Spreadsheet Google Sheets Anda atau paste URL lengkap Spreadsheet tersebut.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste URL Google Sheets atau ID..."
                  value={manualSheetId}
                  onChange={(e) => setManualSheetId(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-sm px-3.5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff] dark:text-white"
                />
                <button
                  onClick={handleConnectSheet}
                  disabled={!manualSheetId.trim()}
                  className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs px-4 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Hubungkan
                </button>
              </div>
            </div>

            {syncError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-900/30">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MAIN ACTIVE DASHBOARD (AUTHENTICATED & LINKED TO SPREADSHEET)
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f2f2f7] dark:bg-black pb-12 flex flex-col relative select-none font-sans">
      
      {/* iOS Status Bar Simulation */}
      <div className="flex justify-between items-center px-6 py-2.5 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-zinc-200/20 dark:border-zinc-800/20 text-zinc-900 dark:text-zinc-100 shrink-0 z-40">
        <span className="text-[11px] font-bold tracking-tight">{currentTime}</span>
        <div className="flex space-x-1.5 items-center">
          <div className="w-3.5 h-3.5 bg-zinc-900 dark:bg-zinc-100 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white dark:bg-zinc-900 rounded-full"></div>
          </div>
          <span className="text-[9px] font-bold tracking-wider">5G</span>
          <div className="w-5 h-2.5 border border-zinc-900/40 dark:border-zinc-100/40 rounded-[3px] relative p-[1px] flex items-center">
            <div className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-[1px]" style={{ width: '80%' }}></div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 16 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-medium rounded-full shadow-lg flex items-center gap-2 border border-zinc-800 dark:border-zinc-200"
          >
            <Check className="w-4 h-4 text-emerald-500" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="ios-glass sticky top-0 z-40 border-b border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3 flex flex-col gap-3">
        
        {/* Row 1: Profile & Sheet sync status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#007aff]/10 text-[#007aff] flex items-center justify-center font-bold text-xs uppercase" title={user?.displayName || 'User'}>
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100">Sheets Connected</span>
                <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></span>
              </div>
              <button 
                onClick={handleDisconnectSheet}
                className="text-[10px] text-[#007aff] dark:text-[#0a84ff] hover:opacity-85 underline flex items-center gap-0.5"
              >
                Lepas Tautan Sheets
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button 
              onClick={handleRefresh}
              disabled={isSyncing}
              className="p-2 text-[#007aff] dark:text-[#0a84ff] hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
              title="Refresh Sheets Data"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={handleCopyShareLink}
              className="p-2 text-[#007aff] dark:text-[#0a84ff] hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors relative"
              title="Copy share link for team"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[#007aff] dark:text-[#0a84ff] hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
              title="Buka Google Sheets"
            >
              <ExternalLink className="w-4 h-4 text-emerald-600" />
            </a>
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Search & Filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari karyawan, peran, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#EEEEF0] dark:bg-zinc-900 text-xs pl-9 pr-8 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007aff] dark:text-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-600" />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="bg-[#EEEEF0] dark:bg-zinc-900 text-xs pl-2.5 pr-6 py-2 rounded-lg focus:outline-none appearance-none dark:text-white font-semibold border-none cursor-pointer"
            >
              <option value="Semua">Semua Divisi</option>
              {DIVISIONS.map((div) => (
                <option key={div.key} value={div.key}>{div.label}</option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Row 3: Segmented Tab bar (iOS Style) */}
        <div className="bg-[#EEEEF0] dark:bg-zinc-850 p-1 rounded-lg flex space-x-1 relative">
          {(['Bulan', 'Daftar', 'Divisi'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all duration-200 z-10 ${
                  isActive 
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs' 
                    : 'text-[#636366] dark:text-zinc-400 hover:text-black dark:hover:text-white'
                }`}
              >
                {tab === 'Bulan' && 'Kalender'}
                {tab === 'Daftar' && 'Semua Jadwal'}
                {tab === 'Divisi' && 'Analisis Divisi'}
              </button>
            );
          })}
        </div>
      </header>

      {/* VIEW PANEL */}
      <main className="flex-1 mt-4">
        
        {/* TAB 1: BULAN (CALENDAR GRID & SELECTED DAY LIST) */}
        {activeTab === 'Bulan' && (
          <div className="space-y-4">
            
            {/* Calendar Widget Container */}
            <div className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              
              {/* Month Navigator Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
                  {viewMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={prevMonth}
                    className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-[#007aff]" />
                  </button>
                  <button 
                    onClick={setToday}
                    className="px-2.5 py-1 text-xs font-bold text-[#ff3b30] hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                  >
                    Hari Ini
                  </button>
                  <button 
                    onClick={nextMonth}
                    className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-[#007aff]" />
                  </button>
                </div>
              </div>

              {/* Day names Row */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, index) => (
                  <span 
                    key={d} 
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      index === 0 || index === 6 ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                {calendarDays.map(({ day, isCurrentMonth, date }, i) => {
                  const formattedCellDate = date.toISOString().split('T')[0];
                  const formattedSelected = selectedDate.toISOString().split('T')[0];
                  const isSelected = formattedCellDate === formattedSelected;
                  
                  const today = new Date();
                  const isToday = date.getDate() === today.getDate() && 
                                  date.getMonth() === today.getMonth() && 
                                  date.getFullYear() === today.getFullYear();
                  
                  const activeDivisions = getDayDivisions(date);

                  return (
                    <div 
                      key={i}
                      onClick={() => setSelectedDate(date)}
                      className={`h-14 flex flex-col justify-between items-center py-1 rounded-lg cursor-pointer relative transition-all ${
                        !isCurrentMonth ? 'opacity-30' : ''
                      } hover:bg-zinc-100/50 dark:hover:bg-zinc-850/40`}
                    >
                      {/* Day Number text bubble (Circular style matching iOS) */}
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-all ${
                        isSelected 
                          ? isToday 
                            ? 'bg-[#ff3b30] text-white shadow-xs' 
                            : 'bg-[#007aff] text-white shadow-xs'
                          : isToday 
                            ? 'text-[#ff3b30] font-extrabold' 
                            : 'text-zinc-900 dark:text-zinc-100'
                      }`}>
                        {day}
                      </span>

                      {/* Division Color Dots */}
                      <div className="flex gap-0.5 justify-center mt-1 w-full h-1 px-0.5">
                        {activeDivisions.slice(0, 4).map((div) => (
                          <span 
                            key={div.key} 
                            className={`w-1.5 h-1.5 rounded-full ${div.dotColor}`}
                          />
                        ))}
                        {activeDivisions.length > 4 && (
                          <span className="text-[7px] leading-none text-zinc-400 dark:text-zinc-500 font-bold">+</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* List Header & Add Button */}
            <div className="px-5 flex items-center justify-between mt-6">
              <h3 className="text-[11px] font-extrabold font-display text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Shift Hari Ini ({selectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
              </h3>
              <button 
                onClick={handleOpenAddForm}
                className="flex items-center gap-1 bg-[#007aff] hover:bg-[#0062cc] dark:bg-[#0a84ff] dark:hover:bg-[#007aff] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm shadow-blue-500/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Shift</span>
              </button>
            </div>

            {/* Shift Details List below the Calendar (iOS Inset Grouped List) */}
            <div className="px-4 pb-4">
              {selectedDateShifts.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-100 dark:border-zinc-800 shadow-xs">
                  <CalendarIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">
                    Tidak ada jadwal shift untuk hari ini.
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/60 shadow-xs divide-y divide-zinc-100 dark:divide-zinc-800/85 overflow-hidden">
                  {selectedDateShifts.map((shift) => {
                    const divInfo = DIVISIONS.find((d) => d.key === shift.division) || DIVISIONS[0];
                    return (
                      <div 
                        key={shift.id}
                        onClick={() => handleOpenEditForm(shift)}
                        className="p-4 flex items-start gap-3.5 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition-colors cursor-pointer"
                      >
                        {/* iOS vertical bar indicator */}
                        <div className="w-1.5 self-stretch rounded-full shrink-0 min-h-[36px]" style={{ backgroundColor: divInfo.color }} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-bold text-zinc-900 dark:text-white leading-tight truncate">
                              {shift.employee}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${divInfo.bgClass} ${divInfo.textClass}`}>
                              {divInfo.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="flex items-center gap-1 font-semibold">
                              <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                              {shift.role || 'Staff'}
                            </span>
                            <span className="flex items-center gap-1 font-mono font-semibold">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              {shift.time} ({shift.shiftName})
                            </span>
                          </div>

                          {shift.notes && (
                            <div className="mt-2.5 bg-zinc-50 dark:bg-zinc-850 p-2.5 rounded-xl text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800/40 flex items-start gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{shift.notes}</span>
                            </div>
                          )}
                        </div>

                        <span className="text-[#007aff] dark:text-[#0a84ff] text-xs font-bold self-center shrink-0">Edit</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: DAFTAR (UPCOMING/ALL MATCHING SHIFTS LIST) */}
        {activeTab === 'Daftar' && (
          <div className="space-y-4 px-4 pb-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[11px] font-extrabold font-display text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Semua Jadwal Kerja ({filteredShifts.length})
              </h3>
              <button 
                onClick={handleOpenAddForm}
                className="flex items-center gap-1 bg-[#007aff] hover:bg-[#0062cc] dark:bg-[#0a84ff] dark:hover:bg-[#007aff] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Shift</span>
              </button>
            </div>

            {filteredShifts.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-200/40 dark:border-zinc-800/60 shadow-xs">
                <Search className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Hasil tidak ditemukan</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Coba sesuaikan pencarian atau filter divisi Anda.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/60 shadow-xs divide-y divide-zinc-100 dark:divide-zinc-800/85 overflow-hidden">
                {filteredShifts
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((shift) => {
                    const divInfo = DIVISIONS.find((d) => d.key === shift.division) || DIVISIONS[0];
                    const shiftDateObj = new Date(shift.date);
                    
                    return (
                      <div 
                        key={shift.id}
                        onClick={() => handleOpenEditForm(shift)}
                        className="p-4 flex items-start gap-3.5 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition-colors cursor-pointer"
                      >
                        {/* iOS vertical bar indicator */}
                        <div className="w-1.5 self-stretch rounded-full shrink-0 min-h-[36px]" style={{ backgroundColor: divInfo.color }} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-extrabold text-[#ff3b30] font-mono tracking-tight uppercase">
                              {shiftDateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${divInfo.bgClass} ${divInfo.textClass}`}>
                              {divInfo.label}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-bold text-zinc-900 dark:text-white leading-tight truncate">
                              {shift.employee}
                            </span>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">
                              {shift.role || 'Staff'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="flex items-center gap-1 font-mono font-semibold">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              {shift.time} ({shift.shiftName})
                            </span>
                          </div>

                          {shift.notes && (
                            <div className="mt-2.5 bg-zinc-50 dark:bg-zinc-850 p-2.5 rounded-xl text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800/40">
                              {shift.notes}
                            </div>
                          )}
                        </div>
                        
                        <span className="text-[#007aff] dark:text-[#0a84ff] text-xs font-bold self-center shrink-0">Edit</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DIVISI (STATS & ANALYTICS OVERVIEW) */}
        {activeTab === 'Divisi' && (
          <div className="space-y-4 px-4 pb-4">
            <h3 className="text-[11px] font-extrabold font-display text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-1">
              Statistik Aktivitas Divisi
            </h3>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/60 shadow-xs divide-y divide-zinc-100 dark:divide-zinc-800/85 overflow-hidden">
              {DIVISIONS.map((div) => {
                const stats = divisionStats[div.key] || { count: 0, hours: 0, employees: new Set() };
                return (
                  <div 
                    key={div.key}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full ${div.dotColor} shadow-xs shrink-0`} />
                      <div>
                        <h4 className="text-sm font-bold text-zinc-950 dark:text-white leading-tight">{div.label}</h4>
                        <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1">
                          {stats.employees.size} karyawan aktif
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 text-right shrink-0">
                      <div>
                        <p className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 font-mono tracking-tight">
                          {stats.count} Shift
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">Frekuensi</p>
                      </div>
                      <div className="border-l border-zinc-100 dark:border-zinc-800 pl-4">
                        <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 font-mono tracking-tight">
                          ~{stats.hours} Jam
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">Total Waktu</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Share Informational box */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-50/20 dark:from-zinc-900 dark:to-zinc-850 p-4 rounded-2xl border border-emerald-100/50 dark:border-zinc-800 text-center space-y-2 mt-6">
              <span className="text-emerald-500 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest block">SINKRONISASI AKTIF</span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Setiap anggota tim yang memiliki izin akses dapat login dan mengedit jadwal shift secara real-time. Link bagikan melampirkan file spreadsheet yang sama.
              </p>
              <button 
                onClick={handleCopyShareLink}
                className="mx-auto mt-2 text-xs font-bold text-[#007aff] hover:underline flex items-center gap-1 justify-center"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin Link Undang Rekan Kerja
              </button>
            </div>
          </div>
        )}

      </main>

      {/* CUPERTINO SHEET / BOTTOM FORM MODAL */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            
            {/* Backdrop glass blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Animated Bottom Sheet container */}
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl border-t border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]"
            >
              
              {/* Drag Handle element */}
              <div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto my-3 shrink-0" />

              {/* Modal Navigation Top bar */}
              <div className="px-4 pb-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <button 
                  onClick={() => setShowFormModal(false)}
                  className="text-xs font-semibold text-[#007aff] hover:opacity-80"
                >
                  Batal
                </button>
                <h3 className="text-sm font-bold font-display text-zinc-950 dark:text-white">
                  {editingShift ? 'Edit Jadwal Kerja' : 'Tambah Jadwal Kerja'}
                </h3>
                <button 
                  onClick={handleSaveShift}
                  className="text-xs font-bold text-[#007aff] hover:opacity-80 disabled:opacity-40"
                  disabled={!formEmployee.trim() || isSyncing}
                >
                  {isSyncing ? 'Sinkron...' : 'Simpan'}
                </button>
              </div>

              {/* Modal Form Scrollable body */}
              <form onSubmit={handleSaveShift} className="flex-1 overflow-y-auto p-4 space-y-5">
                
                {/* Form Group 1: Employee info */}
                <div className="space-y-3.5 bg-[#f2f2f7] dark:bg-zinc-950 p-4 rounded-2xl">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Nama Karyawan *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="text" 
                        required
                        placeholder="Contoh: Budi Santoso"
                        value={formEmployee}
                        onChange={(e) => setFormEmployee(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 text-xs pl-9 pr-3 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#007aff] dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Peran / Jabatan
                    </label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Barista, Staff, Supervisor"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 text-xs px-3 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#007aff] dark:text-white"
                    />
                  </div>
                </div>

                {/* Form Group 2: Division and Date */}
                <div className="space-y-3.5 bg-[#f2f2f7] dark:bg-zinc-950 p-4 rounded-2xl">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Tanggal Kerja *
                    </label>
                    <input 
                      type="date" 
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 text-xs px-3 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#007aff] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Divisi Tim
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DIVISIONS.map((div) => {
                        const isSelected = formDivision === div.key;
                        return (
                          <button
                            type="button"
                            key={div.key}
                            onClick={() => setFormDivision(div.key)}
                            className={`py-2 px-3 text-[10px] font-bold rounded-xl border transition-all text-center ${
                              isSelected 
                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-xs' 
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200/60 dark:border-zinc-800'
                            }`}
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: div.color }} />
                            {div.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Form Group 3: Shift Select and timing */}
                <div className="space-y-3.5 bg-[#f2f2f7] dark:bg-zinc-950 p-4 rounded-2xl">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Kategori / Nama Shift
                    </label>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {SHIFT_PRESETS.map((preset) => {
                        const isSelected = formShiftName === preset.name;
                        return (
                          <button
                            type="button"
                            key={preset.name}
                            onClick={() => handlePresetChange(preset.name)}
                            className={`py-1.5 px-3 text-xs font-bold rounded-full border transition-all shrink-0 ${
                              isSelected 
                                ? 'bg-[#007aff] text-white border-transparent' 
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Waktu Operasional Shift
                    </label>
                    <input 
                      type="text" 
                      placeholder="Contoh: 08:00 - 16:00 atau Libur"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 text-xs px-3 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#007aff] dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Form Group 4: Notes */}
                <div className="bg-[#f2f2f7] dark:bg-zinc-950 p-4 rounded-2xl">
                  <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                    Catatan Khusus (Opsional)
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="Contoh: Handle serah terima kasir"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 text-xs px-3 py-2 rounded-xl border border-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#007aff] dark:text-white resize-none"
                  />
                </div>

                {/* Destroy button if editing */}
                {editingShift && (
                  <button
                    type="button"
                    onClick={handleDeleteShift}
                    className="w-full py-3.5 px-4 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-[#ff3b30] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-red-100 dark:border-red-900/30 transition-all cursor-pointer mt-4"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Jadwal Kerja</span>
                  </button>
                )}

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
