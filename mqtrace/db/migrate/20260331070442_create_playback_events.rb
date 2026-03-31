class CreatePlaybackEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :playback_events do |t|
      t.string :screen_id
      t.string :asset_name
      t.datetime :started_at
      t.integer :duration_secs

      t.timestamps
    end
  end
end
