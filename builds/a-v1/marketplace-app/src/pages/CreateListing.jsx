import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { supabase } from '../config/supabase';
import './CreateListing.css';

const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Art', 'Other'];

export default function CreateListing({ user }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Electronics'
  });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let imageUrl = null;

      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(`public/${fileName}`, image);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('listing-images')
          .getPublicUrl(`public/${fileName}`);
        imageUrl = data.publicUrl;
      }

      const { error: insertError } = await supabase.from('listings').insert([
        {
          seller_id: user.id,
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          category: formData.category,
          image_url: imageUrl,
          status: 'active'
        }
      ]);

      if (insertError) throw insertError;

      navigate('/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-listing-container">
      <div className="create-listing-card">
        <h1>Create a New Listing</h1>
        <p className="subtitle">Share your item with thousands of buyers</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Item Title</label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Vintage Camera"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="price">Price ($)</label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your item..."
              rows="6"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">Item Photo</label>
            <div className="image-upload">
              <input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              <div className="upload-area">
                <Upload size={32} />
                <p>{image ? image.name : 'Click to upload or drag and drop'}</p>
              </div>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Creating...' : 'Create Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}
