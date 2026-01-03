"use client";

import { useState } from "react";
import StudentCardUpload from "./StudentCardUpload";
import FaceRecognition from "./FaceRecognition";
import RegisterForm from "./RegisterForm";
import { useRouter } from "next/navigation";

type BiometricStep = "card" | "face" | "register";

interface UserInfo {
  username: string | null;
  email?: string | null;
  stuId?: string;
  fullName?: string;
  citizenId?: string;
}

export default function BiometricRegister() {
  const [step, setStep] = useState<BiometricStep>("card");
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const router = useRouter();

  const handleCardSuccess = (image: string) => {
    setCardImage(image);
    setStep("face");
  };

  const handleFaceSuccess = (info: UserInfo) => {
    setUserInfo(info);
    setStep("register");
  };

  const handleBackFromFace = () => {
    setCardImage(null);
    router.push("/login")
  };

  const handleBackFromRegister = () => {
    setUserInfo(null);
    setCardImage(null);
    setStep("card");
  };

  return (
    <>
      {step === "card" && <StudentCardUpload onSuccess={handleCardSuccess} />}

      {step === "face" && cardImage && (
        <FaceRecognition
          onSuccess={handleFaceSuccess}
          onBack={handleBackFromFace}
        />
      )}

      {step === "register" && (
        <RegisterForm preFilledData={userInfo || undefined} />
      )}
    </>
  );
}
