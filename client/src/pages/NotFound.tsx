import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, LayoutDashboard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center">
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-ai-500/15 text-ai-400">
          <AlertTriangle className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-text-hi">Page not found</h1>
          <p className="mt-2 text-sm text-text-mid">
            This route does not exist, or it has moved to a different part of IntellMeet.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Link to="/app">
            <Button>
              <LayoutDashboard className="size-4" /> Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
