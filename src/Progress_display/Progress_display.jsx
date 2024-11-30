import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Download, X, Plus } from 'lucide-react';
import { db } from '../firebase-config';
import styles from '../Progress_display/Progress_display.module.css';
import Buttons from '../Buttons/Button.module.css';

const ProgressDisplay = ({ currentUser, onClose }) => {
  const [progressData, setProgressData] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    // Query for "In Progress" events
    const progressQuery = query(
      collection(db, 'event_record'),
      where('status', '==', 'In Progress'),
      where('createdBy', '==', currentUser.uid)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(progressQuery, 
      (snapshot) => {
        const events = [];
        snapshot.forEach((doc) => {
          events.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setProgressData(events);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching progress data:", error);
        setError("Failed to fetch progress data");
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [currentUser]);

  const handleExportProgress = async (eventId) => {

  };

  const handleEventClick = (eventId) => {
    window.open(`/event-details/${eventId}`, '_blank');
  };

  return (
    <div className={styles.Sheet_container}>
      <div className={styles.headclose_container}>
        <h2>In Progress Events</h2>
        <button
          className={`${Buttons.event_buttons} ${Buttons.close_progress}`}
          onClick={onClose}
        >
          <X size={20} />
          Close
        </button>
      </div>

      <div className={styles.Sheet_content}>
        {loading ? (
          <div className={styles.loading_container}>
            <p>Loading progress data...</p>
          </div>
        ) : error ? (
          <div className={styles.error_container}>
            <p>{error}</p>
          </div>
        ) : progressData.length === 0 ? (
          <div className={styles.nothing_here}>
            <p>No events in progress</p>
          </div>
        ) : (
          <table className={styles.Sheet_table}>
            <thead>
              <tr>
                <th className={styles.Sheet_header}>#</th>
                <th className={styles.Sheet_header}>Event Name</th>
                <th className={styles.Sheet_header}>Control ID</th>
                <th className={styles.Sheet_header}>Date Created</th>
                <th className={styles.Sheet_header}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {progressData.map((event, index) => (
                <tr 
                key={event.id}
                className={styles.Sheet_row}
                onClick={() => handleEventClick(event.id)}
                style={{ cursor: 'pointer' }}
              >
                <td className={styles.Sheet_item}>{index + 1}</td>
                <td className={styles.Sheet_item}>{event.event_name}</td>
                <td className={styles.Sheet_item}>{event.id}</td>
                <td className={styles.Sheet_item}>
                  {new Date(event.createdAt).toLocaleDateString()}
                </td>
                <td className={styles.Sheet_item}>
                  <button
                    className={`${Buttons.event_buttons} ${Buttons.download}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportProgress(event.id);
                    }}
                  >
                    <Download size={16} />
                    Download
                  </button>
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProgressDisplay;