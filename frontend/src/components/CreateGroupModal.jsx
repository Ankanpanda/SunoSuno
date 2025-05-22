import { useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { X } from "lucide-react";
import toast from "react-hot-toast";

const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const { users } = useChatStore();
  const { createGroup } = useGroupStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("Please select at least one member");
      return;
    }

    try {
      await createGroup({
        name: groupName.trim(),
        description: description.trim(),
        members: selectedMembers,
      });

      toast.success("Group created successfully");
      onClose();
      setGroupName("");
      setDescription("");
      setSelectedMembers([]);
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg max-w-md w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Create New Group</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Group Name</span>
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Enter group name"
            />
          </div>

          <div>
            <label className="label">
              <span className="label-text">Description (Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea textarea-bordered w-full"
              placeholder="Enter group description"
            />
          </div>

          <div>
            <label className="label">
              <span className="label-text">Select Members</span>
            </label>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center gap-2 p-2 hover:bg-base-200 rounded-lg cursor-pointer"
                  onClick={() => toggleMember(user._id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user._id)}
                    onChange={() => {}}
                    className="checkbox checkbox-sm"
                  />
                  <div className="avatar">
                    <div className="w-8 h-8 rounded-full">
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                      />
                    </div>
                  </div>
                  <span>{user.fullName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;