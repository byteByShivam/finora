import { NextRequest, NextResponse } from 'next/server';
import { RecurringService } from '@/server/services/recurring.service';

export const dynamic = 'force-dynamic';

/**
 * Scheduled cron endpoint for recurring transaction generation.
 * Can be invoked by Vercel Cron, AWS EventBridge, GitHub Actions, or crontab:
 *
 * Example:
 * curl -X POST https://your-domain.com/api/cron/recurring \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Protect the endpoint if CRON_SECRET is configured
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const headerSecret = req.headers.get('x-cron-secret');
    const expectedBearer = `Bearer ${cronSecret}`;

    const isAuthorized =
      authHeader === expectedBearer ||
      headerSecret === cronSecret ||
      authHeader === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await RecurringService.processAllCatchUp();

    return NextResponse.json({
      success: true,
      message: 'Recurring catch-up processing completed successfully.',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[Cron /api/cron/recurring] Execution failed:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Support GET for simple webhook pingers if authorized
export async function GET(req: NextRequest) {
  return POST(req);
}
