import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { VoiceCallInterface } from "../components/VoiceCallInterface";
import { voiceCallService } from "../utils/voiceCallService";

export default function VoiceCallPage() {
  const { targetUserId, targetUserName, isIncoming, callType } =
    useLocalSearchParams();

  const handleEndCall = () => {
    try {
      voiceCallService.hangupCall();
    } catch {}
    try {
      voiceCallService.disconnect();
    } catch {}
    router.back();
  };

  return (
    <VoiceCallInterface
      targetUserId={targetUserId as string}
      targetUserName={targetUserName as string}
      onEndCall={handleEndCall}
      isIncoming={isIncoming === "true"}
      isVideo={callType === "video" ? true : false}
    />
  );
}
