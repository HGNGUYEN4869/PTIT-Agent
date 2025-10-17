import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  input: string;
  file?: File | undefined;
}

const initialState: ChatState = {
  input: "",
  file: undefined,
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
  },
});

export const { setInput, setFile, clearChatState } = chatSlice.actions;
export default chatSlice.reducer;
