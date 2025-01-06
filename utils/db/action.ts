import { db } from "./dbConfig";
import { Notifications, Users, Transactions } from "./schema";
import { eq, sql, and, desc } from "drizzle-orm";

export async function createUser(email: string, name: string) {
  try {
    // after the user is inserted in the database it returns a user object and we distract that here
    const [user] = await db
      .insert(Users)
      .values({ email, name })
      .returning()
      .execute();
    return user;
  } catch (error) {
    console.error("Error creating user", error);
    return null;
  }
}

export async function getUserByEmail(email: string) {
  try {
    const [user] = await db
      .select() //where do you want to selct from
      .from(Users) //from the users table
      .where(eq(Users.email, email)) //seeing whether both the email match
      .execute(); // all find than execute
    return user;
  } catch (error) {
    console.error("Error fetching user by email", error);
    return null;
  }
}

export async function getUnreadNotifications(userId: number) {
  try {
    return await db
      .select()
      .from(Notifications)
      .where(
        and(eq(Notifications.userId, userId), eq(Notifications.isRead, false)) //this will onlt fetch notification that is not read by user
      )
      .execute();
  } catch (error) {
    console.error("Error fetching unread notification", error);
    return null;
  }
}

export async function getUserBalance(userId: number): Promise<number> {
  const transactions = (await getRewardTransactions(userId)) || []; //since we are calling another fucntion withint the function we are using promise

  if (!transactions) return 0;
  const balance = transactions.reduce((acc: number, transaction: any) => {
    return transaction.type.startsWith("earned")
      ? acc + transaction.amount
      : acc - transaction.amount;
  }, 0);
  return Math.max(balance, 0);
}

export async function getRewardTransactions(userId: number) {
  try {
    const transactions = await db
      .select({
        id: Transactions.id,
        type: Transactions.type,
        amount: Transactions.amount,
        description: Transactions.description,
        date: Transactions.date,
      })
      .from(Transactions)
      .where(eq(Transactions.userId, userId))
      .orderBy(desc(Transactions.date))
      .limit(10)
      .execute();

    const formattedTransactions = transactions.map((t) => ({
      ...t,
      date: t.date.toISOString().split("T")[0], //YYYY-MM-DD
    }));

    return formattedTransactions;
  } catch (error) {}
}

export async function markNotificationAsRead(notificationId: number) {
  try {
    await db
      .update(Notifications)
      .set({ isRead: true })
      .where(eq(Notifications.id, notificationId))
      .execute();
  } catch (error) {
    console.error("Error making notification as read", error);
    return null;
  }
}
