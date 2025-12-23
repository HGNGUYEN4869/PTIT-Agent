import Typewriter from "typewriter-effect";

type TypeWriteEffectProps = {
  text: string;
  loop?: boolean;
};

export default function RandomTypewriter({
  text,
  loop = false,
}: TypeWriteEffectProps) {
  return (
    <Typewriter
      options={{
        delay: 75, // tốc độ gõ
        // deleteSpeed: 75, // tốc độ xoá
        loop: loop,
        cursor: ".",
      }}
      onInit={(typewriter) => {
        typewriter.typeString(text).pauseFor(2500);
        // .deleteAll()
        loop && typewriter.deleteAll();
        typewriter.start();
      }}
    />
  );
}
