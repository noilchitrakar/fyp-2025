"use client";
import { useState, useEffect } from "react";
import {
  Trash2,
  MapPin,
  CheckCircle,
  Clock,
  Upload,
  Loader,
  Calendar,
  Weight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import {
  getWasteCollectionTasks,
  updateTaskStatus,
  saveReward,
  saveCollectedWaste,
  getUserByEmail,
} from "@/utils/db/actions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = process.env.GEMINI_API_KEY as any;

type CollectionTask = {
  id: number;
  location: string;
  wasteType: string;
  amount: string;
  status: "pending" | "in_progress" | "completed" | "verified";
  date: string;
  collectorId: number | null;
  reporterId: number; // newly added
  imageUrl: string;
};

const ITEMS_PER_PAGE = 5; //in each collect waste page there are 5 collection task card

export default function CollectPage() {
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredWasteType, setHoveredWasteType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const fetchUserAndTasks = async () => {
      setLoading(true);
      try {
        // Fetch user
        const userEmail = localStorage.getItem("userEmail");
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail);
          if (fetchedUser) {
            setUser(fetchedUser);
          } else {
            toast.error("User not found. Please log in again.");
            // Redirect to login page or handle this case appropriately
          }
        } else {
          toast.error("User not logged in. Please log in.");
          // Redirect to login page or handle this case appropriately
        }

        // Fetch tasks
        const fetchedTasks = await getWasteCollectionTasks();
        // setTasks(fetchedTasks as CollectionTask[]);
        setTasks(fetchedTasks);
      } catch (error) {
        console.error("Error fetching user and tasks:", error);
        toast.error("Failed to load user data and tasks. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndTasks();
  }, []);

  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [verificationImage, setVerificationImage] = useState<string | null>(
    null
  );
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");
  const [verificationResult, setVerificationResult] = useState<{
    wasteTypeMatch: boolean;
    quantityMatch: boolean;
    confidence: number;
  } | null>(null);
  const [reward, setReward] = useState<number | null>(null);

  useEffect(() => {
    // scan every minute for any stale “in_progress” tasks
    const checkExpiry = () => {
      const now = Date.now();
      tasks.forEach((t) => {
        if (t.status === "in_progress") {
          const stamp = localStorage.getItem(`inprogress_${t.id}`);
          if (stamp && now - parseInt(stamp, 10) > 30 * 60 * 1000) {
            // it’s been over 30m → revert it
            handleStatusChange(t.id, "pending");
          }
        }
      });
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [tasks]);
  const handleStatusChange = async (
    taskId: number,
    newStatus: CollectionTask["status"]
  ) => {
    if (!user) {
      toast.error("Please log in to collect waste.");
      return;
    }

    try {
      // Decide whether to pass collectorId
      // - when starting collection or verifying, they are the collector
      // - when reverting to pending, we clear collectorId
      const collectorId =
        newStatus === "in_progress" || newStatus === "verified"
          ? user.id
          : undefined;

      const updatedTask = await updateTaskStatus(
        taskId,
        newStatus,
        collectorId
      );

      if (updatedTask) {
        // Manage our 30-minute stamp in localStorage
        const stampKey = `inprogress_${taskId}`;
        if (newStatus === "in_progress") {
          // mark when they started
          localStorage.setItem(stampKey, Date.now().toString());
        } else {
          // clear whenever they finish or we revert
          localStorage.removeItem(stampKey);
        }

        // Update local React state
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: newStatus,
                  collectorId:
                    newStatus === "in_progress" || newStatus === "verified"
                      ? user.id
                      : null,
                }
              : task
          )
        );

        toast.success("Task status updated successfully");
      } else {
        toast.error("Failed to update task status. Please try again.");
      }
    } catch (error) {
      console.error("Error updating task status:", error);
      toast.error("Failed to update task status. Please try again.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVerificationImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const readFileAsBase64 = (dataUrl: string): string => {
    return dataUrl.split(",")[1];
  };
  console.log("API Key:", geminiApiKey);

  const handleVerify = async () => {
    if (!selectedTask || !verificationImage || !user) {
      toast.error("Missing required information for verification.");
      return;
    }

    setVerificationStatus("verifying");

    try {
      // LOAD ORIGINAL REPORT IMAGE AS BASE64
      const origResp = await fetch(selectedTask.imageUrl);
      const origBlob = await origResp.blob();
      const origBase64: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(origBlob);
      });

      //2) EXTRACT COLLECTED IMAGE AS BASE64
      const collBase64 = readFileAsBase64(verificationImage);

      // 3) BUILD MULTIMODAL PAYLOAD
      const imageParts = [
        {
          inlineData: { data: origBase64, mimeType: origBlob.type },
        },
        {
          inlineData: { data: collBase64, mimeType: "image/jpeg" },
        },
      ];

      // ── 4) COMPARATIVE PROMPT
      const prompt = `
You have TWO images in this order:
1) ORIGINAL report photo of waste.
2) NEWLY uploaded collected waste photo.

Compare them and answer in JSON:
{
  "sameWaste": true/false,     // do they depict the same pile?
  "quantityMatch": true/false, // is the collected amount ≥ reported amount?
  "confidence": number between 0 and 1
}

The originally reported quantity was: ${selectedTask.amount}
`;

      // ── 5) CALL GEMINI
      const genAI = new GoogleGenerativeAI(geminiApiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([prompt, ...imageParts]);
      const raw = await (await result.response).text();
      const cleaned = raw.replace(/```json|```/g, "").trim();
      console.log("Gemini returned:", cleaned);

      // ── 6) PARSE & APPLY
      const parsed = JSON.parse(cleaned);
      // setVerificationResult(parsed);
      setVerificationResult({
        wasteTypeMatch: parsed.sameWaste,
        quantityMatch: parsed.quantityMatch,
        confidence: parsed.confidence,
      });

      setVerificationStatus("success");

      // Only verify if both checks pass at >70% confidence
      if (parsed.sameWaste && parsed.quantityMatch && parsed.confidence > 0.7) {
        await handleStatusChange(selectedTask.id, "verified");

        // Award points
        // const earnedReward = Math.floor(Math.random() * 50) + 10;
        // Trying to extract the numeric value from reported quantity string (e.g., "2.5 kg")
        let extractedWeight = 0;
        const quantityStr = selectedTask.amount || "";

        const match = quantityStr.match(/[\d.]+/); // Extract numbers like 1, 2.5, etc.
        if (match) {
          extractedWeight = parseFloat(match[0]);
        }

        const tokenRate = 10; // 10 tokens per kg
        const earnedReward = Math.max(
          Math.floor(extractedWeight * tokenRate),
          5
        ); // At least 5 tokens

        await saveReward(user.id, earnedReward);
        await saveCollectedWaste(selectedTask.id, user.id, parsed);
        setReward(earnedReward);

        toast.success(
          `Verification successful! You earned ${earnedReward} tokens!`,
          { duration: 5000, position: "top-center" }
        );
      } else {
        toast.error(
          "Verification failed: images do not match or quantity is off.",
          { duration: 5000, position: "top-center" }
        );
      }
    } catch (e) {
      console.error("Error in handleVerify:", e);
      setVerificationStatus("failure");
      toast.error("Something went wrong during verification.", {
        duration: 4000,
        position: "top-center",
      });
    }
  };

  const filteredTasks = tasks.filter((task) =>
    task.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pageCount = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);

  //when the users click on the next page we the do calculation over here(here we slice the first 5 section and render the next section)
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* the waste collection tasks */}
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Waste Collection Tasks
      </h1>
      {/* --- */}
      {/* the search text field and button */}
      <div className="mb-4 flex items-center">
        <Input
          type="text"
          placeholder="Search by area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mr-2"
        />
        <Button variant="outline" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {/* --- */}
      {loading ? (
        //show loading
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin h-8 w-8 text-gray-500" />
        </div>
      ) : (
        //if not loading show all the task (5 task card)
        <>
          <div className="space-y-4">
            {paginatedTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
              >
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-medium text-gray-800 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                    {task.location}
                  </h2>
                  <StatusBadge status={task.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                  <div className="flex items-center relative">
                    <Trash2 className="w-4 h-4 mr-2 text-gray-500" />
                    <span
                      onMouseEnter={() => setHoveredWasteType(task.wasteType)}
                      onMouseLeave={() => setHoveredWasteType(null)}
                      className="cursor-pointer"
                    >
                      {task.wasteType.length > 8
                        ? `${task.wasteType.slice(0, 8)}...`
                        : task.wasteType}
                    </span>
                    {hoveredWasteType === task.wasteType && (
                      <div className="absolute left-0 top-full mt-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                        {task.wasteType}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center">
                    <Weight className="w-4 h-4 mr-2 text-gray-500" />
                    {task.amount}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    {task.date}
                  </div>
                </div>
                <div className="flex justify-end">
                  {/* {task.status === "pending" && (
                    <Button
                      onClick={() => handleStatusChange(task.id, "in_progress")}
                      variant="outline"
                      size="sm"
                    >
                      Start Collection
                    </Button>
                  )} */}
                  {task.status === "pending" &&
                    (user?.id === task.reporterId ? (
                      <span className="text-red-600 text-sm font-medium">
                        Cannot Collect
                      </span>
                    ) : (
                      <Button
                        onClick={() =>
                          handleStatusChange(task.id, "in_progress")
                        }
                        variant="outline"
                        size="sm"
                      >
                        Start Collection
                      </Button>
                    ))}
                  {task.status === "in_progress" &&
                    task.collectorId === user?.id && (
                      <Button
                        onClick={() => setSelectedTask(task)}
                        variant="outline"
                        size="sm"
                      >
                        Complete & Verify
                      </Button>
                    )}
                  {task.status === "in_progress" &&
                    task.collectorId !== user?.id && (
                      <span className="text-yellow-600 text-sm font-medium">
                        In progress by another collector
                      </span>
                    )}
                  {task.status === "verified" && (
                    <span className="text-green-600 text-sm font-medium">
                      Reward Earned
                    </span>
                  )}
                </div>
              </div>
            ))}
            {/* --- */}
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="mr-2"
            >
              Previous
            </Button>
            <span className="mx-2 self-center">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, pageCount))
              }
              disabled={currentPage === pageCount}
              className="ml-2"
            >
              Next
            </Button>
          </div>
        </>
      )}
      {/* ------- */}
      {/* when user selects a task we want to show a form that is going to spin up
      for the user to select and image and verify the task (below is the code for that */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Verify Collection</h3>
            <p className="mb-4 text-sm text-gray-600">
              Upload a photo of the collected waste to verify and earn your
              reward.
            </p>
            <div className="mb-4">
              <label
                htmlFor="verification-image"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Upload Image
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="verification-image"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="verification-image"
                        name="verification-image"
                        type="file"
                        className="sr-only"
                        onChange={handleImageUpload}
                        accept="image/*"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              </div>
            </div>
            {verificationImage && (
              <img
                src={verificationImage}
                alt="Verification"
                className="mb-4 rounded-md w-full"
              />
            )}
            <Button
              onClick={handleVerify}
              className="w-full"
              disabled={
                !verificationImage || verificationStatus === "verifying"
              }
            >
              {verificationStatus === "verifying" ? (
                <>
                  <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
                  Verifying...
                </>
              ) : (
                "Verify Collection"
              )}
            </Button>
            {verificationStatus === "success" && verificationResult && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <p>
                  Waste Type Match:{" "}
                  {verificationResult.wasteTypeMatch ? "Yes" : "No"}
                </p>
                <p>
                  Quantity Match:{" "}
                  {verificationResult.quantityMatch ? "Yes" : "No"}
                </p>
                <p>
                  Confidence: {(verificationResult.confidence * 100).toFixed(2)}
                  %
                </p>
              </div>
            )}
            {verificationStatus === "failure" && (
              <p className="mt-2 text-red-600 text-center text-sm">
                Verification failed. Please try again.
              </p>
            )}
            <Button
              onClick={() => setSelectedTask(null)}
              variant="outline"
              className="w-full mt-2"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CollectionTask["status"] }) {
  const statusConfig = {
    pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
    in_progress: { color: "bg-blue-100 text-blue-800", icon: Trash2 },
    completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    verified: { color: "bg-purple-100 text-purple-800", icon: CheckCircle },
  };

  const { color, icon: Icon } = statusConfig[status];

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${color} flex items-center`}
    >
      <Icon className="mr-1 h-3 w-3" />
      {status.replace("_", " ")}
    </span>
  );
}
