import { prisma } from './prisma';
import { subDays, startOfDay } from 'date-fns';

type AlertType = 'no_new_users' | 'low_retention' | 'no_activity';

async function shouldCreateAlert(type: AlertType): Promise<boolean> {
  const today = startOfDay(new Date());
  const existing = await prisma.alert.findFirst({
    where: {
      type,
      isRead: false,
      triggeredAt: { gte: today },
    },
  });
  return !existing;
}

async function checkNoNewUsers(): Promise<void> {
  const threshold = subDays(new Date(), 2);
  const count = await prisma.appUser.count({ where: { createdAt: { gte: threshold } } });
  if (count === 0 && (await shouldCreateAlert('no_new_users'))) {
    await prisma.alert.create({
      data: {
        type: 'no_new_users',
        message: 'Aucun nouvel utilisateur inscrit depuis 48 heures.',
        threshold: 0,
      },
    });
    console.log('[alertChecker] Alert created: no_new_users');
  }
}

async function checkLowRetention(): Promise<void> {
  const threshold = 30;
  const cohortSince = subDays(new Date(), 60);

  const [retained, total] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT e.user_id) as count FROM app_users u
      JOIN events e ON e.user_id = u.user_id
        AND e.timestamp >= u.created_at + INTERVAL '7 days'
        AND e.timestamp < u.created_at + INTERVAL '8 days'
      WHERE u.created_at >= ${cohortSince}`,
    prisma.appUser.count({ where: { createdAt: { gte: cohortSince } } }),
  ]);

  if (total === 0) return;
  const rate = (Number(retained[0]?.count ?? 0) / total) * 100;

  if (rate < threshold && (await shouldCreateAlert('low_retention'))) {
    await prisma.alert.create({
      data: {
        type: 'low_retention',
        message: `Rétention J7 à ${rate.toFixed(1)}% — seuil de ${threshold}% non atteint.`,
        threshold,
      },
    });
    console.log(`[alertChecker] Alert created: low_retention (${rate.toFixed(1)}%)`);
  }
}

async function checkNoActivity(): Promise<void> {
  const since = subDays(new Date(), 1);
  const count = await prisma.event.count({ where: { timestamp: { gte: since } } });
  if (count === 0 && (await shouldCreateAlert('no_activity'))) {
    await prisma.alert.create({
      data: {
        type: 'no_activity',
        message: 'Aucun événement enregistré depuis 24 heures.',
        threshold: 0,
      },
    });
    console.log('[alertChecker] Alert created: no_activity');
  }
}

export async function runAlertChecker(): Promise<void> {
  try {
    await Promise.all([checkNoNewUsers(), checkLowRetention(), checkNoActivity()]);
  } catch (err) {
    console.error('[alertChecker] Error:', err);
  }
}

export function startAlertChecker(): void {
  runAlertChecker();
  setInterval(runAlertChecker, 60 * 60 * 1000);
  console.log('[alertChecker] Started (interval: 1h)');
}
