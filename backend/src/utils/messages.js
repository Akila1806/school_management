const Messages = {
  Agent: {
    EmptyMessage: 'Message cannot be empty',
    NoDataToExport: 'No data found to export',
    AllStudents: (count) => `Here are all ${count} students currently enrolled in the system.`,
    QueryResults: (count) => `Here are the ${count} results matching your query.`,
  },

  Student: {
    IdRequired: 'Student ID is required',
    FormDataRequired: 'Form data is required',
    NotFound: (id) => `Student with ID ${id} not found`,
    InsertFailed: 'Insert failed',
    InvalidSql: 'Invalid SQL generated',
    UpdateSuccess: 'Student updated successfully',
  },

  Dashboard: {
    MetricRequired: 'Metric parameter is required',
    MetricsArrayRequired: 'Metrics array is required',
    CacheCleared: 'Dashboard cache cleared successfully',
  },
}

module.exports = { Messages }
