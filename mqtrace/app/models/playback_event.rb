# PlaybackEvent is an ActiveRecord model.
#
# In Rails, a model class automatically maps to a database table.
# The table name is derived by pluralizing and snake_casing the class name:
#   PlaybackEvent → playback_events
# This is "convention over configuration" — no annotation needed, unlike Java
# where you would write @Entity @Table(name="playback_events").
#
# ApplicationRecord is the base class (Rails 5+). It inherits from ActiveRecord::Base.
# Java/Spring Boot equivalent: a JPA entity class with @Entity.
#
# Columns (defined in the migration, NOT in this file):
#   id           :integer    — primary key, added automatically by Rails (no @Id annotation needed)
#   screen_id    :string     — identifier of the screen that played the asset
#   asset_name   :string     — filename of the asset that was played
#   started_at   :datetime   — UTC timestamp when playback began
#   duration_secs :integer   — how long the asset played, in seconds
#   created_at   :datetime   — auto-managed by Rails (equivalent to @CreatedDate in Spring Data)
#   updated_at   :datetime   — auto-managed by Rails (equivalent to @LastModifiedDate in Spring Data)

class PlaybackEvent < ApplicationRecord

  # ActiveRecord validations run before save/create.
  # If any validation fails:
  #   - record.save   → returns false, does NOT raise an exception
  #   - record.save!  → raises ActiveRecord::RecordInvalid with a message
  #   - record.create → same as save (returns the record with errors attached)
  #   - record.create! → same as save! (raises)
  #
  # Java/Spring Boot equivalent: Jakarta Bean Validation with @NotNull, @NotBlank.
  # Key difference: Rails validations are in the model class, not on field annotations.

  # presence: true → the value must not be nil AND must not be an empty string.
  # Java equivalent: @NotBlank (for strings) or @NotNull (for objects).
  validates :screen_id,    presence: true
  validates :asset_name,   presence: true
  validates :started_at,   presence: true

  # numericality adds both a type check and a value constraint.
  # greater_than: 0 means duration must be at least 1 second.
  # Java equivalent: @NotNull @Min(1) on an Integer field.
  validates :duration_secs, presence: true,
                             numericality: { only_integer: true, greater_than: 0 }

end
