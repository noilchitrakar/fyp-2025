import {
  ShieldCheck,
  BarChart2,
  Award,
  Globe,
  Trash2,
  UploadCloud,
  Leaf,
  Users,
  Zap,
  Clock,
  MapPin,
  Flower,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function HeroIllustration() {
  return (
    <div className="relative w-40 h-40 mx-auto mb-8">
      <div className="absolute inset-0 rounded-full bg-blue-100/40 animate-pulse"></div>
      <div className="absolute inset-4 rounded-full bg-blue-200/30 animate-ping"></div>
      <div className="absolute inset-8 flex items-center justify-center rounded-full bg-white shadow-lg border-4 border-blue-100">
        <Flower className="h-16 w-16 text-blue-600 animate-float" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="text-center mb-24">
        <HeroIllustration />
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-gray-900 tracking-tight">
          Transform Waste Into{" "}
          <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            Value
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-10">
          Smart waste management powered by community participation and
          blockchain rewards
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2">
            <UploadCloud className="h-5 w-5" />
            Report Waste
          </Button>
          <Button
            variant="outline"
            className="text-lg py-6 px-8 rounded-xl border-blue-300 text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2"
          >
            <BarChart2 className="h-5 w-5" />
            View Rankings
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mb-24">
        <div className="text-center mb-16">
          <span className="inline-block bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
            WHY CHOOSE US
          </span>
          <h2 className="text-4xl font-bold text-gray-900">
            Modern Waste Management Solutions
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={ShieldCheck}
            title="Verified Reporting"
            description="AI-powered waste verification ensures accurate reporting and prevents fraud"
            color="text-blue-500"
          />
          <FeatureCard
            icon={Award}
            title="Earn Rewards"
            description="Collect tokens for every verified waste report and redeem for prizes"
            color="text-amber-500"
          />
          <FeatureCard
            icon={Zap}
            title="Real-time Tracking"
            description="Monitor waste collection and processing in real-time on our platform"
            color="text-emerald-500"
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-blue-50 to-cyan-50 p-12 rounded-3xl mb-24">
        <h2 className="text-3xl font-bold text-center mb-16 text-gray-900">
          Our Environmental Impact
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard
            icon={Trash2}
            value="5.2K+"
            label="Waste Reports"
            description="Verified waste submissions"
          />
          <StatCard
            icon={Leaf}
            value="42K+"
            label="KG Recycled"
            description="Diverted from landfills"
          />
          <StatCard
            icon={Users}
            value="1.2K+"
            label="Active Users"
            description="Community members"
          />
          <StatCard
            icon={Clock}
            value="24/7"
            label="Monitoring"
            description="Real-time tracking"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white border border-gray-200 rounded-3xl p-12 text-center shadow-sm">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          Ready to make a difference?
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Join thousands of users transforming waste management in their
          communities
        </p>
        <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-lg py-6 px-10 rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all">
          Get Started Now
        </Button>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  color = "text-blue-500",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color?: string;
}) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-blue-100 flex flex-col items-center">
      <div
        className={`bg-blue-50 ${color.replace(
          "text",
          "bg"
        )}/10  rounded-xl w-12 h-12 flex items-center justify-center mb-6`}
      >
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <h3 className="text-xl font-bold mb-4 text-gray-900 text-center">
        {title}
      </h3>
      <p className="text-gray-600 leading-relaxed  text-center">
        {description}
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  description,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
      <div className="bg-blue-100/30 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
