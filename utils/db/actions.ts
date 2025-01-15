import { db } from "./dbConfig";
import { Notifications, Users, Transactions, Reports, Rewards } from "./schema";
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

export async function createReport(
  userId: number,
  location: string,
  wasteType: string,
  amount: string,
  imageUrl?: string,
  verificationResult?: any
) {
  try {
    const [report] = await db
      .insert(Reports)
      .values({
        userId,
        location,
        wasteType,
        amount,
        imageUrl,
        verificationResult,
        status: "pending",
      })
      .returning()
      .execute();
    // What the user is going to be rewarded when reporting waste
    const pointsEarned = 10;
    // updateRewardsPoints
    await updateRewardsPoints(userId, pointsEarned);

    //createTransaction
    await createTransaction(
      userId,
      "earned_report",
      pointsEarned,
      "Points earned for reporting waste"
    );

    //createNotification
    await createNotification(
      userId,
      `You've earned ${pointsEarned} points for reporting waste!`,
      "reward"
    );
    return report;
  } catch (e) {
    console.error("Error creating report", e);
    return null;
  }
}

export async function updateRewardsPoints(userId: number, pointsToAdd: number) {
  try {
    const [updatedReward] = await db
      .update(Rewards) //updating the Rewards table
      .set({
        points: sql`${Rewards.points} +${pointsToAdd}`, // columns updating
      })
      .where(eq(Rewards.userId, userId)) //only updating that matches the userID
      .returning()
      .execute();
    return updatedReward;
  } catch (e) {
    console.error("Error updating reward points", e);
    return null;
  }
}

export async function createTransaction(
  userId: number,
  type: "earned_report" | "earned_collect" | "redeemed",
  amount: number,
  description: string
) {
  try {
    const [transaction] = await db
      .insert(Transactions) //inserting into the Transcations table
      .values({ userId, type, amount, description }) //the values we are inserting
      .returning()
      .execute();
    return transaction;
  } catch (e) {
    console.error("Error creating transaction:", e);
    throw e;
  }
}

export async function createNotification(
  userId: number,
  message: string,
  type: string
) {
  try {
    const [notification] = await db
      .insert(Notifications) //inserting into the Notification table
      .values({ userId, message, type }) //the values we are inserting
      .returning()
      .execute();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

export async function getRecentReports(limit: number = 10) {
  //the (limit : number =10) will show only the lastest 10 recent reports
  try {
    const reports = await db
      .select()
      .from(Reports) //selecting from the Reports table
      .orderBy(desc(Reports.createdAt)) //only selecting from the descending order of time (from latest to past) (10 reports)
      .limit(limit) //this will make it so that it only takes the first 10 from the descending order
      .execute();
    return reports;
  } catch (error) {
    console.error("Error fetching recent reports:", error);
    return []; //if error return an empty array if there is nothing
  }
}

export async function getAvailableRewards(userId: number) {
  try {
    console.log("Fetching available rewards for user:", userId);

    // Get user's total points
    const userTransactions = (await getRewardTransactions(userId)) as any;
    const userPoints = userTransactions?.reduce(
      (total: any, transaction: any) => {
        return transaction.type.startsWith("earned")
          ? total + transaction.amount
          : total - transaction.amount;
      },
      0
    );

    console.log("User total points:", userPoints);

    // Get available rewards from the database
    const dbRewards = await db
      .select({
        id: Rewards.id,
        name: Rewards.name,
        cost: Rewards.points,
        description: Rewards.description,
        collectionInfo: Rewards.collectionInfo,
      })
      .from(Rewards)
      .where(eq(Rewards.isAvailable, true))
      .execute();

    console.log("Rewards from database:", dbRewards);

    // Combine user points and database rewards
    const allRewards = [
      {
        id: 0, // Use a special ID for user's points
        name: "Your Points",
        cost: userPoints,
        description: "Redeem your earned points",
        collectionInfo: "Points earned from reporting and collecting waste",
      },
      ...dbRewards,
    ];

    console.log("All available rewards:", allRewards);
    return allRewards;
  } catch (error) {
    console.error("Error fetching available rewards:", error);
    return [];
  }
}