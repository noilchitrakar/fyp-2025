"use client";
import { useState, useCallback, useEffect } from "react";
import {
  MapPin,
  Upload,
  CheckCircle,
  Loader,
  UploadCloud,
  Scan,
  Trash2,
  Scale,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGenerativeAI } from "@google/generative-ai";
// import { StandaloneSearchBox, useJsApiLoader } from "@react-google-maps/api";
// import { Libraries } from "@react-google-maps/api";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  createUser,
  getUserByEmail,
  createReport,
  getRecentReports,
} from "@/utils/db/actions";

const geminiApiKey = process.env.GEMINI_API_KEY as any;
// const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY as any;

// const libraries: Libraries = ["places"]; for google maps api (not putting it because need money)

export default function ReportPage() {
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
  } | null>(null);

  const router = useRouter();

  const [reports, setReports] = useState<
    Array<{
      id: number;
      location: string;
      wasteType: string;
      amount: string;
      createdAt: string;
    }>
  >([]);

  const [newReport, setNewReport] = useState({
    location: "",
    type: "",
    amount: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");

  const [verificationResult, setVerificationResults] = useState<{
    wasteType: string;
    quantity: string;
    confidence: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  //   const [searchBox, setSearchBox] =
  //     useState<google.maps.places.SearchBox | null>(null);

  //   const { isLoaded } = useJsApiLoader({
  //     id: "google-map-script",
  //     googleMapsApiKey: googleMapsApiKey!,
  //     libraries: libraries,
  //   });

  //   const onLoad = useCallback((ref: google.maps.places.SearchBox) => {
  //     setSearchBox(ref);
  //   }, []);

  //   const onPlacesChanged = () => {
  //     if (searchBox) {
  //       const places = searchBox.getPlaces();
  //       if (places && places.length > 0) {
  //         const place = places[0];
  //         setNewReport((prev) => ({
  //           ...prev,
  //           location: place.formatted_address || "",
  //         }));
  //       }
  //     }
  //   };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewReport({ ...newReport, [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile); //this will read the input image with gemini AI
    }
  };

  //this will read the input image with gemini AI
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  console.log("API Key:", geminiApiKey);

  //this will verify the Image using google generative AI
  const handleVerify = async () => {
    if (!file) return;

    setVerificationStatus("verifying");

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const base64Data = await readFileAsBase64(file);

      const imageParts = [
        {
          inlineData: {
            data: base64Data.split(",")[1],
            mimeType: file.type,
          },
        },
      ];

      //the prompt for analyzing image and giving the waste Information
      const prompt = `You are an expert in waste management and recycling. Analyze this image and provide:
        1. The type of waste (e.g., plastic, paper, glass, metal, organic)
        2. An estimate of the quantity or amount (in kg or liters)
        3. Your confidence level in this assessment (as a percentage)
        
        Provide your response strictly in JSON format, without any extra text or explanation(don't write JSON inside the output):
          {
            "wasteType": "type of waste",
            "quantity": "estimated quantity with unit",
            "confidence": confidence level as a number between 0 and 1
          }
          #note 
          don't output as follows
          json
              {
                "wasteType": "Mixed waste (plastic, metal, paper, glass, batteries)",
                "quantity": "Approximately 1 kg",
                "confidence": 0.7
              }
          instead just output
              {
                "wasteType": "Mixed waste (plastic, metal, paper, glass, batteries)",
                "quantity": "Approximately 1 kg",
                "confidence": 0.7
              }
        `;

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      //printing the raw AI response
      console.log("Raw response:", text);

      //Formating it into understandable Json format
      const cleanedText = text.replace(/```json|```/g, "").trim(); //bug fixer

      //printing the clearned JSON response
      console.log("cleaned response:", cleanedText);

      //to display result in front end
      try {
        const parsedResult = JSON.parse(cleanedText);
        if (
          parsedResult.wasteType &&
          parsedResult.quantity &&
          parsedResult.confidence
        ) {
          setVerificationResults(parsedResult);
          setVerificationStatus("success");
          setNewReport({
            ...newReport,
            type: parsedResult.wasteType,
            amount: parsedResult.quantity,
          });
        } else {
          console.error("Invalid verification result:", parsedResult);
          setVerificationStatus("failure");
        }
      } catch (e) {
        console.error("Failed to parse JSON response:", text);
        setVerificationStatus("failure");
      }
    } catch (e) {
      console.error("Error verifying waste:", e);
      setVerificationStatus("failure");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationStatus !== "success" || !user) {
      toast.error("Please verify the waste before submitting or log in.");
      return;
    }
    setIsSubmitting(true);

    try {
      const report = (await createReport(
        user.id, //getting the ID from user state
        newReport.location,
        newReport.type,
        newReport.amount,
        preview || undefined, //if there is no image url
        verificationResult ? JSON.stringify(verificationResult) : undefined
      )) as any;

      //Ths will help in Recent reports (below the image submission part)
      const formattedReport = {
        id: report.id,
        location: report.location,
        wasteType: report.wasteType,
        amount: report.amount,
        createdAt: report.createdAt.toISOString().split("T")[0],
      };

      // setting the Recent Report(we are appending the the recent report from what we are getting from the database)
      setReports([formattedReport, ...reports]);
      setNewReport({ location: "", type: "", amount: "" });

      //after we are done submitting the iamge and report updating it all to default(null).
      setFile(null);
      setPreview(null);
      setVerificationStatus("idle");
      setVerificationResults(null);

      // after the report has been submitted successfully(showing a toast notification)
      toast.success(
        `Report submitted successfully! You've earned points for reporting waste.`
      );
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      //will run regardless if there is an error or successful run
      setIsSubmitting(false);
    }
  };

  //use effect that will check the user authentication and fetch the Recents report
  useEffect(() => {
    const checkUser = async () => {
      const email = localStorage.getItem("userEmail"); //we will save the user email inside the localstorage
      if (email) {
        let user = await getUserByEmail(email);
        if (!user) {
          user = await createUser(email, "Anonymous User");
        }
        setUser(user);

        const recentReports = (await getRecentReports()) as any;
        const formattedReports = recentReports.map((report: any) => ({
          ...report,
          createdAt: report.createdAt.toISOString().split("T")[0], //this will convert it into YYYY-MM-DD
        }));
        //after we are done setting the report we update the state to formatted reports
        setReports(formattedReports);
      } else {
        //if their is no email we want to redirect the user to the Home Page
        router.push("/");
        // router.push("/login");
      }
    };
    checkUser();
  }, [router]); //anytime the router change we want to reender this use effect or the side effect

  // returning the actual component for the page.tsx part
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Report Waste</h1>
        <p className="text-lg text-gray-600 max-w-3xl">
          Contribute to cleaner communities by reporting waste and earning
          rewards for your environmental efforts.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">
        {/* Form Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-6">
          <h2 className="text-2xl font-semibold text-white">
            New Waste Report
          </h2>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-8">
          {/* Image Upload Section */}
          <div className="mb-10">
            <label className="block text-lg font-medium text-gray-800 mb-4">
              Upload Waste Image
            </label>

            <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 transition-all duration-300 bg-gray-50/50">
              <div className="space-y-3 text-center">
                <div className="mx-auto bg-blue-100/30 p-4 rounded-full w-16 h-16 flex items-center justify-center">
                  <UploadCloud className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex flex-col sm:flex-row text-sm text-gray-600 items-center justify-center gap-1">
                  <label
                    htmlFor="waste-image"
                    className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500"
                  >
                    <span className="text-base">Click to upload</span>
                    <input
                      id="waste-image"
                      name="waste-image"
                      type="file"
                      className="sr-only"
                      onChange={handleFileChange}
                      accept="image/*"
                    />
                  </label>
                  <p className="text-gray-500">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
              </div>
            </div>
          </div>

          {/* Image Preview */}
          {preview && (
            <div className="mt-6 mb-8 flex justify-center">
              <div className="relative group">
                <img
                  src={preview}
                  alt="Waste preview"
                  className="max-w-full h-64 object-contain rounded-lg shadow-md border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setPreview("")}
                  className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Verify Button */}
          <Button
            type="button"
            onClick={handleVerify}
            className="w-full mb-8 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white py-4 text-lg rounded-xl shadow-md transition-all duration-300"
            disabled={!file || verificationStatus === "verifying"}
          >
            {verificationStatus === "verifying" ? (
              <>
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Analyzing Waste...
              </>
            ) : (
              <>
                <Scan className="h-5 w-5 mr-2" />
                Analyze Waste
              </>
            )}
          </Button>

          {/* Verification Result */}
          {verificationStatus === "success" && verificationResult && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8 rounded-r-xl">
              <div className="flex items-start">
                <CheckCircle className="h-6 w-6 text-blue-500 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">
                    Analysis Complete
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-500 font-medium">
                        Waste Type
                      </p>
                      <p className="font-medium">
                        {verificationResult.wasteType}
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-500 font-medium">
                        Quantity
                      </p>
                      <p className="font-medium">
                        {verificationResult.quantity}
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-500 font-medium">
                        Confidence
                      </p>
                      <p className="font-medium">
                        {(verificationResult.confidence * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Location Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={newReport.location}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Enter waste location"
                />
              </div>
            </div>

            {/* Waste Type Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Waste Type
              </label>
              <div className="relative">
                <Trash2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="type"
                  name="type"
                  value={newReport.type}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Verified waste type"
                  readOnly
                />
              </div>
            </div>

            {/* Amount Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Amount
              </label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="amount"
                  name="amount"
                  value={newReport.amount}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Verified amount"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500  hover:from-blue-700 hover:to-cyan-600 text-white py-4 text-lg rounded-xl shadow-md transition-all duration-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Submitting Report...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Submit Report
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Recent Reports Section */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Recent Reports
        </h2>
        <p className="text-gray-600">Your community's latest contributions</p>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Reported
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="flex-shrink-0 h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {report.location}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {report.wasteType}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{report.amount}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {report.createdAt}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
