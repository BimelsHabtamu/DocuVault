/**
 * M-2: Client-side service for the authenticated Recipient area.
 * All calls require a valid Bearer token with role=recipient.
 */

import { api, getAuthToken } from './api';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const recipientService = {
  /**
   * Lists all document deliveries addressed to the current recipient.
   * Returns an array of delivery + doc + template summary objects.
   */
  listMyDeliveries: () => api.get('/recipient/documents'),

  /**
   * Streams a confirmed-ownership document as a blob and triggers a save-as
   * download — same pattern as documentService.download.
   */
  download: async (deliveryId) => {
    const res = await fetch(`${BASE_URL}/recipient/documents/${deliveryId}/download`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!res.ok) {
      let message = 'Failed to download the document.';
      try {
        const payload = await res.json();
        message = payload.message || message;
      } catch { /* non-JSON body */ }
      throw new Error(message);
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    const filename = match ? match[1] : `document-${deliveryId}.pdf`;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Verifies the integrity of a specific delivered document.
   * Returns { verified, message, docId, storedHash, recomputedHash, ... }.
   */
  verify: (deliveryId) => api.get(`/recipient/documents/${deliveryId}/verify`),
};
