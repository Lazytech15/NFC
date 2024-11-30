// AddEventForm.jsx
import React, { useState } from 'react';
import styles from '../Add_event/Add_event.module.css';
import Buttons from '../Buttons/Button.module.css';
import { X, Save } from 'lucide-react';

const AddEventForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    eventName: '',
    location: '',
    description: ''
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.eventName.trim()) {
      newErrors.eventName = 'Event name is required';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  return (
    <div className={styles.event_form_overlay}>
      <div className={styles.event_form_container}>
        <div className={styles.event_form_content}>
          <h2>Add New Event</h2>
          
          <form onSubmit={handleSubmit} className={styles.event_form}>
            <div className={styles.form_group}>
              <label>Event Name</label>
              <input
                type="text"
                name="eventName"
                value={formData.eventName}
                onChange={handleChange}
                className={errors.eventName ? '{styles.error}' : ''}
                placeholder="Enter event name"
              />
              {errors.eventName && (
                <p className={styles.error_message}>{errors.eventName}</p>
              )}
            </div>

            <div className={styles.form_group}>
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className={errors.location ? '{styles.error}' : ''}
                placeholder="Enter event location"
              />
              {errors.location && (
                <p className={styles.error_message}>{errors.location}</p>
              )}
            </div>

            <div className={styles.form_group}>
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                className={errors.description ? '{styles.error}' : ''}
                placeholder="Enter event description"
              />
              {errors.description && (
                <p className={styles.error_message}>{errors.description}</p>
              )}
              <p className={styles.character_count}>
                {formData.description.length}/500 characters
              </p>
            </div>

            <div className={styles.form_actions}>
              <button 
                type="button" 
                onClick={onCancel}
                className={`${Buttons.event_buttons} ${Buttons.cancel}`}
              >
                <X size={20} />
                Cancel
              </button>
              <button 
                type="submit"
                className={`${Buttons.event_buttons} ${Buttons.submit}`}
              >
                <Save size={20} />
                Add Event
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEventForm;