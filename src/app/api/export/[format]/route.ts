import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import prisma from '@/server/db/prisma';
import { formatDateTime } from '@/lib/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ format: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { format } = await params;

  // Retrieve user's transactions
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    include: {
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { occurredAt: 'desc' },
  });

  // Audit log for sensitive export
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'data.export',
      entityType: 'Transaction',
      metadata: { format, count: transactions.length },
    },
  });

  if (format === 'csv') {
    const csvHeader = 'ID,Date,Account,Category,Type,Amount,Currency,Description,Notes\n';
    const csvRows = transactions
      .map((t) => {
        const desc = (t.description || '').replace(/"/g, '""');
        const notes = (t.notes || '').replace(/"/g, '""');
        const cat = (t.category?.name || 'Uncategorized').replace(/"/g, '""');
        const acc = t.account.name.replace(/"/g, '""');
        const dateStr = formatDateTime(t.occurredAt);
        return `"${t.id}","${dateStr}","${acc}","${cat}","${t.type}",${t.amount.toString()},"${t.currency}","${desc}","${notes}"`;
      })
      .join('\n');

    const csvContent = csvHeader + csvRows;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="finora-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (format === 'json') {
    return NextResponse.json({
      exportDate: new Date().toISOString(),
      user: { id: user.id, name: user.name, email: user.email },
      totalTransactions: transactions.length,
      transactions,
    });
  }

  // HTML Printable format (for PDF printing via browser Ctrl+P or print stylesheet)
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Finora Financial Ledger Statement</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; font-weight: 600; color: #334155; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    .income { color: #059669; }
    .expense { color: #dc2626; }
    .transfer { color: #2563eb; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <h1>Finora Financial Statement</h1>
  <div class="meta">
    Prepared for: <strong>${user.name}</strong> (${user.email}) | Date: ${new Date().toLocaleDateString()} | Records: ${transactions.length}
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th>Category</th>
        <th>Account</th>
        <th>Type</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${transactions
        .map(
          (t) => `<tr>
          <td>${formatDateTime(t.occurredAt)}</td>
          <td>${t.description || '-'}</td>
          <td>${t.category?.name || 'Uncategorized'}</td>
          <td>${t.account.name}</td>
          <td class="${t.type}">${t.type.toUpperCase()}</td>
          <td class="amount ${t.type}">${t.currency} ${Number(t.amount).toFixed(2)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
