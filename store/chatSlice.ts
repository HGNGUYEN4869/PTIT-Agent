import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  input: string;
  file?: File | undefined;
  refreshHistory: number; // Trigger để refresh history
}

const initialState: ChatState = {
  input: "",
  file: undefined,
  refreshHistory: 0,
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
  },
});

export const { setInput, setFile, clearChatState, triggerRefreshHistory } =
  chatSlice.actions;
export default chatSlice.reducer;
