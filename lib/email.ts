/**
 * Helper to send emails via the internal /api/email route.
 */
export async function sendEmailNotification(to: string, subject: string, html: string) {
  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, html }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('Failed to send email:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling email API:', error);
    return false;
  }
}
