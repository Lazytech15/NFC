import styles from '../Add_student/Addstudent.module.css'
import React, { useState } from 'react';
import Buttons from '../Buttons/Button.module.css';
import { X, Save } from 'lucide-react';

const AddStudentForm = ({ onSubmit, onCancel }) => {
  const [studentData, setStudentData] = useState({
    studentNumber: '',
    studentName: '',
    studentCourse: '',
    studentCampus: '',
    date: new Date().toLocaleDateString()
  });
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!studentData.studentNumber.trim()) {
      setError('Student number is required');
      return false;
    }
    if (!studentData.studentName.trim()) {
      setError('Student name is required');
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(studentData);
    }
  };

  return (
    <div className={styles.modal_overlay}>
      <div className={styles.modal_container}>
        <h3 className={styles.modal_title}>Add New Student</h3>
        
        <form onSubmit={handleSubmit} className={styles.form_container}>
          {error && (
            <div className={styles.error_message}>{error}</div>
          )}
          
          <div className={styles.form_group}>
            <label className={styles.form_label}>
              Student Number:
            </label>
            <input
              type="text"
              value={studentData.studentNumber}
              onChange={(e) => setStudentData({
                ...studentData,
                studentNumber: e.target.value
              })}
              className={styles.form_input}
              placeholder="Enter student number"
            />
          </div>
          
          <div className={styles.form_group}>
            <label className={styles.form_label}>
              Student Name:
            </label>
            <input
              type="text"
              value={studentData.studentName}
              onChange={(e) => setStudentData({
                ...studentData,
                studentName: e.target.value
              })}
              className={styles.form_input}
              placeholder="Enter student name"
            />
          </div>

          <div className={styles.form_group}>
            <label className={styles.form_label}>
              Course:
            </label>
            <input
              type="text"
              value={studentData.studentCourse}
              onChange={(e) => setStudentData({
                ...studentData,
                studentCourse: e.target.value
              })}
              className={styles.form_input}
              placeholder="Enter student Course"
            />
          </div>

          <div className={styles.form_group}>
            <label className={styles.form_label}>
              Campus:
            </label>
            <input
              type="text"
              value={studentData.studentCampus}
              onChange={(e) => setStudentData({
                ...studentData,
                studentCampus: e.target.value
              })}
              className={styles.form_input}
              placeholder="Enter student Campus"
            />
          </div>
          
          <div className={styles.form_group}>
            <label className={styles.form_label}>
              Date:
            </label>
            <input
              type="text"
              value={studentData.date}
              onChange={(e) => setStudentData({
                ...studentData,
                date: e.target.value
              })}
              className={styles.form_input}
              placeholder="MM/DD/YYYY"
            />
          </div>
          
          <div className={styles.button_container}>
            <button
              type="submit"
              className={`${Buttons.event_buttons} ${Buttons.submit}`}
            >
              <Save size={16} />
              Add Student
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`${Buttons.event_buttons} ${Buttons.cancel}`}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudentForm;