import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import styles from './Folder_Management.module.css';
import { Save, X } from 'lucide-react';

const AddProgressRow = ({ eventId, onCancel, onSuccess }) => {
  const [formData, setFormData] = useState({
    studentNumber: '',
    studentName: '',
    date: new Date().toLocaleDateString()
  });
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const docRef = doc(db, eventId, formData.studentNumber);
      await setDoc(docRef, {
        Student_name: formData.studentName,
        date: formData.date
      });
      
      onSuccess();
      onCancel();
    } catch (error) {
      console.error("Error adding progress row:", error);
      setError("Failed to add row. Please try again.");
    }
  };

  return (
    <div className={styles.add_form}>
      <h3>Add New Student</h3>
      {error && <p className={styles.error_message}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Student Number"
          value={formData.studentNumber}
          onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Student Name"
          value={formData.studentName}
          onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Date (MM/DD/YYYY)"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          required
        />
        <div className={styles.form_buttons}>
          <button type="submit" className={styles.save_button}>
            <Save size={16} />
            Save
          </button>
          <button type="button" onClick={onCancel} className={styles.cancel_button}>
            <X size={16} />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProgressRow;