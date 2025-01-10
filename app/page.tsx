//this is the Home Page section( Hero Section )
import {
  ArrowRight,
  Leaf,
  Recycle,
  Users,
  Coins,
  MapPin,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import Link from "next/link";

// the main leaf animation(animated Globe)
function AnimatedGlobe() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-8">
      {/* the sourounding animation for the leaf (animation like pulse) */}
      <div className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-pulse"></div>
      <div className="absolute inset-2 rounded-full bg-green-400 opacity-40 animate-ping"></div>
      <div className="absolute inset-4 rounded-full bg-green-300 opacity-60 animate-spin"></div>
      <div className="absolute inset-6 rounded-full bg-green-200 opacity-80 animate-bounce"></div>
      {/* the main leaf */}
      <Leaf className="absolute inset-0 m-auto h-16 w-16 text-green-600 animate-pulse" />
    </div>
  );
}

//The actual component for the home page(The main content component passsing )
export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      <section className="text-center mb-20">
        {/* the main leaf globe */}
        <AnimatedGlobe />
        {/* the main header */}
        <h1 className="text-6xl font-bold mb-6 text-gray-800 tracking-tight">
          WasteSnap{" "}
          <span className="text-green-600">Waste to Rewards Managament </span>
        </h1>
        {/* the paragraph section */}
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
          Join our communty in making management more efficent and rewarding
        </p>
        {/* the report waste/waste snapshpt button */}
        <Button className="bg-green-600 hover:bg-green-700 text-white text-lg py-6 px-10 rounded-full">
          Waste SnapShot
        </Button>
      </section>

      {/* the new section that contains the three feature card */}
      <section className="grid md:grid-cols-3 gap-10 mb-20">
        {/* calling the featurecard component 3 times with their own new content 
        (the icon title description are passed to the feature card function*/}
        <FeatureCard
          icon={Leaf}
          title="Eco-friendly"
          description="We are comitted to reducing waste and prompting sustanibility"
        />
        <FeatureCard
          icon={Coins}
          title="Eco-friendly"
          description="We are comitted to reducing waste and prompting sustanibility"
        />
        <FeatureCard
          icon={Coins}
          title="Eco-friendly"
          description="We are comitted to reducing waste and prompting sustanibility"
        />
      </section>
      {/* the impact card section */}
      <section className="bg-white p-10 rounded-3xl shadow-lg mb-20">
        <h2 className="text-4xl font-bold mb-12 text-center text-gray-800">
          Our Impact
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {/* calling the impact card  
          changes here you can make all these data(the value={database real time data}) are supposed to come 
          from database try to make it with the amount of waste collected, report submitted,
          tokens earned, and co2 offset in the your own wesbite(Wastesnap)*/}
          <ImpactCard title="Waste collected" value={"20 Kg"} icon={Recycle} />
          <ImpactCard title="Reprot submitted" value={"30"} icon={MapPin} />
          <ImpactCard title="Tokens Earned" value={"200"} icon={Coins} />
          <ImpactCard title="C02 offset" value={"50"} icon={Leaf} />
        </div>
      </section>
    </div>
  );
}

//the feature card component(components are like block when combined creates the whole page and components can be reused)
function FeatureCard({
  // these are the props
  icon: Icon,
  title,
  description,
}: {
  // these are the props datatype
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    // the outer white card
    <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col items-center text-center ">
      {/* the icon inside the white card */}
      <div className="bg-green-100 p-4 rounded-full mb-6">
        <Icon className="h-8 w-8 text-green-600" />
      </div>
      {/* the heading and the paragraph */}
      <h3 className="text-xl font-semibold mb-4 text-gray-800">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

//here the impact card is going the accept the title ,value and icon props
function ImpactCard({
  // these are the props
  title,
  value,
  icon: Icon,
}: {
  // these are the props datatype
  title: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    // the main white border
    <div className="p-6 rounded-xl bg-gray-50 border border-gray-100 transition-all duration-300 ease-in-out hover:shadow-md">
      {/* the icon */}
      <Icon className="h-10 w-10 text-green-500 mb-4" />
      {/* the paragraphs for the value and title */}
      <p className="text-3xl font-bold mb-2 text-gray-800">{value}</p>
      <p className="text-sm text-gray-600">{title}</p>
    </div>
  );
}
