import { redirect, notFound } from "next/navigation";
import { toast } from "sonner";
import { getCallData } from "@/actions/call";
import CallRoom from "./_components/CallRoom";

export default async function CallPage({ params }) {
  const { callId } = await params;

  const result = await getCallData(callId);

  if (result.error === "Unauthorized") {
    toast.error("You must be signed in to access this call");
    redirect("/");
  }
  if (result.error === "Call not found") {
    toast.error("This call does not exist");
    notFound();
  }
  if (result.error === "Forbidden") {
    toast.error("You do not have permission to access this call");
    redirect("/");
  }

  const { token, isInterviewer, currentUser, booking } = result;

  return (
    <CallRoom
      callId={callId}
      token={token}
      apiKey={process.env.NEXT_PUBLIC_STREAM_API_KEY}
      currentUser={currentUser}
      booking={booking}
      isInterviewer={isInterviewer}
    />
  );
}
