export interface Shift {
  id: string;
  date: string; // Format: YYYY-MM-DD
  division: string;
  shiftName: string; // e.g., Pagi, Siang, Malam, Off
  time: string; // e.g., 08:00 - 16:00
  employee: string;
  role: string;
  notes: string;
}

// Helper to make Google API requests
async function googleFetch(url: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP error ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

/**
 * Creates a brand new Google Sheet in the user's Google Drive with a custom title and "Shifts" sheet.
 */
export async function createNewSpreadsheet(title: string, token: string): Promise<string> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: {
      title: title || 'Jadwal Shift Kerja - Team Shift Calendar',
    },
    sheets: [
      {
        properties: {
          title: 'Shifts',
        },
      },
    ],
  };

  const data = await googleFetch(url, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const spreadsheetId = data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Gagal mendapatkan ID Spreadsheet baru.');
  }

  // Initialize spreadsheet with headers
  await initializeHeaders(spreadsheetId, token);

  return spreadsheetId;
}

/**
 * Sets up headers in the first row of the "Shifts" sheet.
 */
async function initializeHeaders(spreadsheetId: string, token: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Shifts!A1:H1?valueInputOption=USER_ENTERED`;
  const body = {
    range: 'Shifts!A1:H1',
    majorDimension: 'ROWS',
    values: [
      ['ID', 'Tanggal', 'Divisi', 'Nama Shift', 'Waktu', 'Karyawan', 'Peran', 'Catatan'],
    ],
  };

  await googleFetch(url, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Fetches all shifts from the Google Sheet.
 */
export async function fetchShifts(spreadsheetId: string, token: string): Promise<Shift[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Shifts!A2:H1000`;
  
  try {
    const data = await googleFetch(url, token, { method: 'GET' });
    const rows = data.values as string[][] | undefined;
    
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((row) => ({
      id: row[0] || '',
      date: row[1] || '',
      division: row[2] || '',
      shiftName: row[3] || '',
      time: row[4] || '',
      employee: row[5] || '',
      role: row[6] || '',
      notes: row[7] || '',
    })).filter(shift => shift.id && shift.date); // Filter out invalid entries
  } catch (error: any) {
    // If the table layout doesn't match or the sheet isn't initialized yet
    if (error.message?.includes('RANGE_INVALID') || error.message?.includes('not found')) {
      await initializeHeaders(spreadsheetId, token);
      return [];
    }
    throw error;
  }
}

/**
 * Clears old data and saves all current shifts to the Google Sheet.
 */
export async function syncShifts(spreadsheetId: string, shifts: Shift[], token: string): Promise<void> {
  // 1. Clear existing range from A2 to H1000
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Shifts!A2:H1000:clear`;
  await googleFetch(clearUrl, token, {
    method: 'POST',
  });

  // If there are no shifts, clearing is enough
  if (shifts.length === 0) return;

  // 2. Put new shifts
  const writeRange = `Shifts!A2:H${shifts.length + 1}`;
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`;
  
  const values = shifts.map((shift) => [
    shift.id,
    shift.date,
    shift.division,
    shift.shiftName,
    shift.time,
    shift.employee,
    shift.role,
    shift.notes,
  ]);

  const body = {
    range: writeRange,
    majorDimension: 'ROWS',
    values,
  };

  await googleFetch(writeUrl, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
