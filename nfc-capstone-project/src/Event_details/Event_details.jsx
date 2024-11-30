import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc,setDoc } from 'firebase/firestore';
import { db, database, ref, set, auth } from '../firebase-config';
import Buttons from '../Buttons/Button.module.css';
import { ArrowLeft, Plus, FileDown, Pencil, Trash2, Save } from 'lucide-react';
import styles from '../Event_details/Event_details.module.css';

const EventDetails = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Set up listener for auth state changes
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        // Optionally redirect to login page if user is not authenticated
        // navigate('/login');
      }
    });

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        if (!eventId) {
          setError('No event ID provided');
          setLoading(false);
          return;
        }

        const eventDoc = await getDoc(doc(db, 'event_record', eventId));
        if (eventDoc.exists()) {
          setEvent({ id: eventDoc.id, ...eventDoc.data() });
        } else {
          setError('Event not found');
        }
      } catch (err) {
        console.error('Error fetching event details:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]);

  // Student data management functions
  const generateId = () => `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addRow = () => {
    const newRow = {
      id: generateId(),
      studentId: '',
      studentName: '',
      course: '',
      campus: '',
      date: new Date().toISOString().split('T')[0],
      isEditing: true
    };
    setRows([...rows, newRow]);
  };

  const handleInputChange = (id, field, value) => {
    setRows(rows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const deleteRow = (id) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const toggleEdit = (id) => {
    setRows(rows.map(row =>
      row.id === id ? { ...row, isEditing: !row.isEditing } : row
    ));
  };

  const exportToFirestore = async () => {
    setLoading(true);
    setError(null);
  
    try {
      for (const row of rows) {
        const studentData = {
          studentId: row.studentId,
          Student_name: row.studentName,
          course: row.course,
          campus: row.campus,
          eventId: eventId,
          createdAt: new Date().toISOString()
        };
  
        const studentDocRef = doc(db, `${eventId}`, row.studentId);
        await setDoc(studentDocRef, studentData);
      }
  
      setLoading(false);
      setRows([]); // Clear the rows after successful export
    } catch (err) {
      console.error('Error exporting to Firestore:', err);
      setError('Failed to export data. Please try again.');
      setLoading(false);
    }
  };
  

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorContainer}>{error}</div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div style={{ textAlign: 'center' }}>No event found</div>
          </div>
        </div>
      </div>
    );
  }

  const saveToRealtimeDb = async () => {
    setSaving(true);
    setError(null);
  
    try {
      const studentsRef = ref(database, `events/${eventId}/students`);
  
      // Convert rows array to an object with row IDs as keys
      const studentsData = rows.reduce((acc, row) => {
        acc[row.id] = {
          studentId: row.studentId,
          studentName: row.studentName,
          course: row.course,
          campus: row.campus,
          date: row.date,
          lastUpdated: new Date().toISOString()
        };
        return acc;
      }, {});
  
      await set(studentsRef, studentsData);
  
      setSaving(false);
    } catch (err) {
      console.error('Error saving to Realtime Database:', err);
      setError('Failed to save data to Realtime Database. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      
      <button
        onClick={() => navigate(-1)}
        className={styles.backButton}
      >
        <ArrowLeft size={20} />
        Back to Events
      </button>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>{event.event_name}</h1>
          <div className={styles.createdDate}>
            Created on {new Date(event.createdAt).toLocaleDateString()}
          </div>
        </div>

        <div className={styles.cardContent}>
          <div className={styles.statusBadge}>{event.status}</div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>Event ID</div>
              <div className={styles.detailValue}>{event.id}</div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>Current User email</div>
              <div className={styles.detailValue}>{currentUser?.email || 'Not signed in'}</div>
            </div>

            {event.description && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Description</div>
              <div className={styles.detailValue}>{event.description}</div>
            </div>
          )}

            {event.location && (
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}>Location</div>
                <div className={styles.detailValue}>{event.location}</div>
              </div>
            )}

            {/* {event.participants && (
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}>Participants</div>
                <div className={styles.detailValue}>
                  {event.participants.length} participants
                </div>
              </div>
            )} */}

          
          </div>

          

          {/* {event.additionalData && Object.keys(event.additionalData).length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Additional Information</div>
              <div className={styles.additionalInfo}>
                {Object.entries(event.additionalData).map(([key, value]) => (
                  <div key={key} className={styles.detailItem}>
                    <span style={{ fontWeight: 500 }}>{key}: </span>
                    <span>{typeof value === 'object' ? JSON.stringify(value) : value}</span>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* Student Data Management Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>On Going Attendance Record</div>
              <div className={styles.buttonGroup}>
                <button 
                  onClick={addRow}
                  className={`${Buttons.event_buttons} ${Buttons.add_Row}`}
                >
                  <Plus size={16} />
                  Add Row
                </button>
                <button 
                  onClick={saveToRealtimeDb}
                  disabled={saving || rows.length === 0}
                  className={`${Buttons.event_buttons} ${Buttons.save}`}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save to Realtime DB'}
                </button>
                <button 
                  onClick={exportToFirestore}
                  disabled={loading || rows.length === 0}
                  className={`${Buttons.event_buttons} ${Buttons.export}`}
                >
                  <FileDown size={16} />
                  Export to Firestore
                </button>
              </div>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Course</th>
                    <th>Campus</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>
                        {row.isEditing ? (
                          <input
                            type="text"
                            value={row.studentId}
                            onChange={(e) => handleInputChange(row.id, 'studentId', e.target.value)}
                            className={styles.input}
                          />
                        ) : row.studentId}
                      </td>
                      <td>
                        {row.isEditing ? (
                          <input
                            type="text"
                            value={row.studentName}
                            onChange={(e) => handleInputChange(row.id, 'studentName', e.target.value)}
                            className={styles.input}
                          />
                        ) : row.studentName}
                      </td>
                      <td>
                        {row.isEditing ? (
                          <input
                            type="text"
                            value={row.course}
                            onChange={(e) => handleInputChange(row.id, 'course', e.target.value)}
                            className={styles.input}
                          />
                        ) : row.campus}
                      </td>
                      <td>
                        {row.isEditing ? (
                          <input
                            type="text"
                            value={row.campus}
                            onChange={(e) => handleInputChange(row.id, 'campus', e.target.value)}
                            className={styles.input}
                          />
                        ) : row.campus}
                      </td>
                      <td>
                        {row.isEditing ? (
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleInputChange(row.id, 'date', e.target.value)}
                            className={styles.input}
                          />
                        ) : row.date}
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.iconButton}
                            onClick={() => toggleEdit(row.id)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className={`${styles.iconButton} ${styles.deleteButton}`}
                            onClick={() => deleteRow(row.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;