export const Messages = {
  Student: {
    // Validation
    FirstNameRequired: "First name is required",
    LastNameRequired: "Last name is required",
    FullNameRequired: "Full name is required",
    GradeRequired: "Grade is required",
    DobRequired: "Date of birth is required",
    GenderRequired: "Gender is required",
    FatherNameRequired: "Father's name is required",
    FatherOccupationRequired: "Father's occupation is required",
    MotherNameRequired: "Mother's name is required",
    AddressRequired: "Address is required",
    ParentPhoneRequired: "Parent phone number is required",
    InvalidPhone: "Please enter a valid phone number",

    // API
    SaveSuccess: (name: string) => `✅ ${name} saved successfully!`,
    UpdateSuccess: (name: string) => `✅ ${name} updated successfully!`,
    SaveError: "Error saving student",
    UpdateError: "Error updating student",
    AlreadyUpdated: (name: string) => `${name} already updated. Load a new student to make changes.`,

    // UI
    ClearConfirm: "Clear all fields?",
    UnsavedConfirm: "You have unsaved changes. Are you sure you want to close?",
    Submitting: "Submitting...",
    Updating: "Updating...",
    AlreadyUpdatedBtn: "✅ Updated Students",
  },

  Chat: {
    Thinking: "Thinking...",
    ConnectionError: "Connection error",
    ServerError: "Server error",
    Copied: "Copied!",
    Copy: "Copy",
  },

  Dashboard: {
    NoResults: "No results received from API",
    LoadError: "Failed to load dashboard data",
    TooManyRequests: "Too many requests. Please wait a moment and try again.",
  },
}
