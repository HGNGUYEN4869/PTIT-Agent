import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  input: string;
  file?: File | undefined;
  refreshHistory: number; // Trigger để refresh history
  isAgentMode: boolean; // Agent mode để ẩn sidebar và thu nhỏ chat
}

const initialState: ChatState = {
  input: "",
  file: undefined,
  refreshHistory: 0,
  isAgentMode: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setInput(state, action: PayloadAction<string>) {
      state.input = action.payload;
    },
    setFile(state, action: PayloadAction<File | undefined>) {
      state.file = action.payload;
    },
    clearChatState(state) {
      state.input = "";
      state.file = undefined;
    },
    // Trigger refresh history sidebar
    triggerRefreshHistory(state) {
      state.refreshHistory += 1;
    },
    // Set agent mode
    setAgentMode(state, action: PayloadAction<boolean>) {
      state.isAgentMode = action.payload;
    },
  },
});

export const {
  setInput,
  setFile,
  clearChatState,
  triggerRefreshHistory,
  setAgentMode,
} = chatSlice.actions;
export default chatSlice.reducer;
