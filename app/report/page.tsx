"use client";
import { useState, useCallback, useEffect } from "react";
import { MapPin, Upload, CheckCircle, Loader } from "lucide-react";
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
      const cleanedText = text.replace(/```json|```/g, "").trim();

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
    <div className="p-8 max-w-4xl mx-auto text-gray-800">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Report waste
      </h1>
      {/* the main form part inside the white box*/}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-lg mb-12"
      >
        <div className="mb-8">
          <label
            htmlFor="waste-image"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            Upload Waste Image
          </label>

          {/* ---- */}
          {/* the first section of the form */}
          {/* the upload waste image and (Upload a fileNo file chosen 
          or drag and drop PNG, JPG, GIF up to 10MB) section */}
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="waste-image"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="waste-image"
                    name="waste-image"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
        </div>
        {/* --- */}
        {/* section for the preview */}
        {preview && ( // this is an preview and is updated when we upload an image
          <div className="mt-4 mb-8">
            <img
              src={preview} //the image url is whatever the data URL that we have saved inside the state
              alt="Waste preview"
              className="max-w-full h-auto rounded-xl shadow-md" //styles and class name for the preview
            />
          </div>
        )}
        {/* --- */}
        {/* the verify waste button  */}
        <Button
          type="button"
          onClick={handleVerify} //when the button is clicked "handleVerify" function executes
          className="w-full mb-8 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300"
          disabled={!file || verificationStatus === "verifying"} //make this button disabled if there is no file (meaning if there is no file uploaded)
        >
          {verificationStatus === "verifying" ? ( //when verificationStatus is verifying (loads an buffer animation)
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Verifying...
            </>
          ) : (
            "Verify Waste"
          )}
        </Button>
        {/* --- */}
        {/* if the verification is successful we want to display this card 
        this will contain all the information about the verification result
        coming from the AI*/}
        {verificationStatus === "success" && verificationResult && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-green-800">
                  Verification Successful
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Waste Type: {verificationResult.wasteType}</p>
                  <p>Quantity: {verificationResult.quantity}</p>
                  <p>
                    Confidence:{" "}
                    {(verificationResult.confidence * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* --- */}
        {/* the input boxes section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* the Div for location and input field */}
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>

            {/* the below code is commented out because i don't have money for Google maps API */}
            {/* {isLoaded ? (
              <StandaloneSearchBox
                onLoad={onLoad}
                onPlacesChanged={onPlacesChanged}
              >
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={newReport.location}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                  placeholder="Enter waste location"
                />
              </StandaloneSearchBox>
            ) : (
              <input
                type="text"
                id="location"
                name="location"
                value={newReport.location}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                placeholder="Enter waste location"
              />
            )} */}

            <input
              type="text"
              id="location"
              name="location"
              value={newReport.location}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
              placeholder="Enter waste location"
            />
          </div>

          {/* the Div for waste type and input field */}
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Waste Type
            </label>
            <input
              type="text"
              id="type"
              name="type"
              value={newReport.type}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified waste type"
              readOnly
            />
          </div>

          {/* the Div for waste amount and input field */}
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Estimated Amount
            </label>
            <input
              type="text"
              id="amount"
              name="amount"
              value={newReport.amount}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified amount"
              readOnly
            />
          </div>
        </div>
        {/* --- */}
        {/* the button for uploading/submitting the waste report */}

        <Button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Submitting...
            </>
          ) : (
            "Submit Report"
          )}
        </Button>
      </form>
      {/* --------------------- */}
      {/* the Recent Reports section */}

      {/* the header for the recent reports */}
      <h2 className="text-3xl font-semibold mb-6 text-gray-800">
        Recent Reports
      </h2>

      {/* --- */}

      {/* creating the table for Recent reports that will come from the database */}

      {/* just creating the white big box  */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* creating the table part maximum height for the table is set to 96*/}
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            {/* ---- */}
            {/* just the table heads  */}
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            {/* ---- */}

            {/* the table bodies  */}
            <tbody className="divide-y divide-gray-200">
              {/* looping through all the report  */}
              {reports.map((report) => (
                // table row
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  {/* table data  */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {/* including the MapPin Icon from lucide react */}
                    <MapPin className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {report.location}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.wasteType}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.amount}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.createdAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- */}
    </div>
  );
}
