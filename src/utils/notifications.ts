import * as Notifications from 'expo-notifications';

// Expo maps days to numbers: Sunday = 1, Monday = 2, etc.
const DAY_MAP: Record<string, number> = {
  'Sun': 1, 'Mon': 2, 'Tue': 3, 'Wed': 4, 'Thu': 5, 'Fri': 6, 'Sat': 7
};

export const scheduleClassAlarm = async (subject: string, startTime: string, day: string, room: string) => {
  // 1. Parse "09:15 AM" into hours and minutes
  const [time, modifier] = startTime.trim().split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  // 2. The Time-Math Trick
  // We use a dummy Date object because JS automatically handles hour roll-overs
  // If we subtract 30 mins from 09:15, JS automatically turns it into 08:45
  const alarmDate = new Date();
  alarmDate.setHours(hours);
  alarmDate.setMinutes(minutes - 30);
  alarmDate.setSeconds(0);

  const alarmHour = alarmDate.getHours();
  const alarmMinute = alarmDate.getMinutes();
  const alarmWeekday = DAY_MAP[day];

  // 3. Schedule the repeating weekly alarm
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏳ Class Alert: ${subject}`,
      body: `Starts in 30 mins in ${room}. Get moving!`,
      sound: true,
      data: { subject, day },
    },
    trigger: {
      weekday: alarmWeekday,
      hour: alarmHour,
      minute: alarmMinute,
      repeats: true, // This makes it fire every week on this specific day!
    },
  });

  // We return the ID so we can save it. If you delete the class, we need this ID to cancel the alarm.
  return notificationId;
};

export const cancelAlarm = async (notificationId: string) => {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
};