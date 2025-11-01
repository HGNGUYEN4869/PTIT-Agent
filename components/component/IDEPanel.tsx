import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import IDETerminal from "./IDETerminal";
import { SerialMonitor } from "./SerialMonitor";

type IDEPanelProps = {
  isCompiling?: boolean;
  compileSessionId: string;
  serialPort?: SerialPort | null;
};

const IDEPanel = ({ compileSessionId, serialPort, isCompiling }: IDEPanelProps) => {

  // tab hiện tại
  const [activeTab, setActiveTab] = useState<string>("terminal");

  // Khi isCompiling = true → tự động chuyển sang tab "terminal"
  useEffect(() => {
    if (isCompiling) {
      setActiveTab("terminal");
    }
  }, [isCompiling]);
  return (
    <>
      <div className="flex w-full flex-col gap-6">
        <Tabs className="w-full gap-0"
        value={activeTab} 
        onValueChange={setActiveTab}
        >
          <TabsList className="rounded-none bg-[#1e1e1e] p-0">
            <TabsTrigger
              value="terminal"
              className="rounded-none bg-[#1e1e1e] text-white data-[state=active]:bg-[#2e2e2e]"
            >
              Terminal
            </TabsTrigger>
            <TabsTrigger
              value="serial-monitor"
              className="rounded-none bg-[#1e1e1e] text-white data-[state=active]:bg-[#2e2e2e]"
            >
              Serial Monitor
            </TabsTrigger>
          </TabsList>
          <TabsContent value="terminal" className="w-full">
            <IDETerminal sessionId={compileSessionId} />
          </TabsContent>
          <TabsContent value="serial-monitor" className="w-full">
            <SerialMonitor serialPort={serialPort || null} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};
export default IDEPanel;
